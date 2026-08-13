import { catalogPartSchema, computeCommission, orderSchema, sellerSchema, subOrderSchema } from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import { onDocumentWritten } from 'firebase-functions/v2/firestore'
import { getAppConfig } from '../checkout/appConfig.js'
import { postLedgerEntries, readLedger } from '../tax/ledger.js'
import { getCommissionConfig } from './commissionConfig.js'

/** subOrder statuses that mean "nothing left for the buyer to receive or pay COD cash for" — used to decide whether a COD order's siblings have all settled, so paymentStatus can flip to 'paid'. */
const SETTLED_SUB_ORDER_STATUSES = new Set(['delivered', 'returned', 'refunded', 'cancelled', 'rejected'])

/**
 * Fires on every subOrder write; posts the seller's commission (design brief
 * item 4: "applied at delivery, not order placement") the moment `status`
 * transitions to `delivered`. Same before/after status-edge guard shape as
 * generateInvoiceOnShipped.ts, with the same three-way duplicate-generation
 * guard (before/after edge check here, a fresh re-read + `commissionPaise`
 * check inside the transaction).
 *
 * Posts `order_credit` (the full subOrder value), `shipping_charge` (the
 * cost the platform fronted booking the shipment, recovered from the
 * seller), and `commission_debit` — see pricing/commission.ts's rate
 * precedence. Denormalizes `commissionPaise`/`tcsPaise`/`tdsPaise`/
 * `netPayableToSellerPaise` onto the subOrder so
 * functions/src/payments/runSellerPayouts.ts never has to re-derive money
 * math from ledger entries posted at two different trigger timings (TCS/TDS
 * at `shipped`/invoice time, commission here at `delivered` time).
 */
export const applyCommissionOnDelivered = onDocumentWritten(
  { document: 'subOrders/{subOrderId}', region: 'asia-south1' },
  async (event) => {
    const before = event.data?.before.exists ? event.data.before.data() : undefined
    const after = event.data?.after.exists ? event.data.after.data() : undefined
    if (!after || before?.status === 'delivered' || after.status !== 'delivered' || after.commissionPaise !== undefined) {
      return
    }

    const subOrderId = event.params.subOrderId as string
    const db = getFirestore()

    try {
      const [orderSnapshot, sellerSnapshot] = await Promise.all([
        db.collection('orders').doc(after.orderId as string).get(),
        db.collection('sellers').doc(after.sellerId as string).get(),
      ])
      if (!orderSnapshot.exists || !sellerSnapshot.exists) {
        logger.error('applyCommissionOnDelivered: order or seller missing', { subOrderId })
        return
      }
      const order = orderSchema.parse({ id: orderSnapshot.id, ...orderSnapshot.data() })
      const seller = sellerSchema.parse({ id: sellerSnapshot.id, ...sellerSnapshot.data() })

      const [appConfig, commissionConfig] = await Promise.all([getAppConfig(), getCommissionConfig()])

      await db.runTransaction(async (tx) => {
        const subOrderRef = db.collection('subOrders').doc(subOrderId)
        const subOrderSnapshot = await tx.get(subOrderRef)
        if (!subOrderSnapshot.exists) return
        const subOrder = subOrderSchema.parse({ id: subOrderSnapshot.id, ...subOrderSnapshot.data() })
        if (subOrder.status !== 'delivered' || subOrder.commissionPaise !== undefined) return

        const catalogPartRefs = subOrder.items.map((item) => db.collection('catalogParts').doc(item.partId))
        const catalogPartSnapshots = await Promise.all(catalogPartRefs.map((ref) => tx.get(ref)))

        const now = Date.now()

        // TCS/TDS were already posted at invoice/shipped time
        // (generateInvoiceOnShipped.ts), referencing the invoice — read them
        // back out so netPayableToSellerPaise nets them without re-deriving.
        let tcsPaise = 0
        let tdsPaise = 0
        if (subOrder.invoiceId) {
          const entriesSnapshot = await tx.get(
            db
              .collection('ledgers')
              .doc(seller.id)
              .collection('entries')
              .where('referenceType', '==', 'invoice')
              .where('referenceId', '==', subOrder.invoiceId),
          )
          for (const doc of entriesSnapshot.docs) {
            const entry = doc.data()
            const type = entry.type as string
            const signedAmount = (entry.direction === 'debit' ? 1 : -1) * (entry.amountPaise as number)
            if (type === 'tcs_debit') tcsPaise += signedAmount
            if (type === 'tds_debit') tdsPaise += signedAmount
          }
        }

        let commissionPaise = 0
        subOrder.items.forEach((item, index) => {
          const catalogPartSnapshot = catalogPartSnapshots[index]
          const categorySlug =
            catalogPartSnapshot?.exists ? catalogPartSchema.parse({ id: catalogPartSnapshot.id, ...catalogPartSnapshot.data() }).categorySlug : undefined
          const taxableValuePaise = item.lineSubtotalPaise - item.lineDiscountPaise
          const commission = computeCommission(
            {
              taxableValuePaise,
              categorySlug,
              sellerId: seller.id,
              sellerOverridePercent: seller.commissionRatePercent,
              platformDefaultPercent: appConfig.platformCommissionDefaultPercent,
              now,
            },
            commissionConfig,
          )
          commissionPaise += commission.totalPaise
        })

        const netPayableToSellerPaise =
          subOrder.totalPaise - subOrder.shippingPaise - commissionPaise - Math.max(0, tcsPaise) - Math.max(0, tdsPaise)

        // ---- remaining reads (must all happen before any writes below) ----
        const ledgerRead = await readLedger(tx, db, seller.id)
        const isCodOrder = order.paymentMethod === 'cod' && order.paymentStatus !== 'paid'
        const siblingIds = isCodOrder ? order.subOrderIds.filter((id) => id !== subOrder.id) : []
        const siblingSnapshots = isCodOrder
          ? await Promise.all(siblingIds.map((id) => tx.get(db.collection('subOrders').doc(id))))
          : []

        // ---- writes ----
        postLedgerEntries(
          tx,
          db,
          ledgerRead,
          seller.id,
          [
            {
              type: 'order_credit',
              direction: 'credit',
              amountPaise: subOrder.totalPaise,
              referenceType: 'subOrder',
              referenceId: subOrder.id,
              description: `Sale value for subOrder ${subOrder.id}`,
            },
            {
              type: 'shipping_charge',
              direction: 'debit',
              amountPaise: subOrder.shippingPaise,
              referenceType: 'subOrder',
              referenceId: subOrder.id,
              description: `Shipping cost recovered for subOrder ${subOrder.id}`,
            },
            {
              type: 'commission_debit',
              direction: 'debit',
              amountPaise: commissionPaise,
              referenceType: 'subOrder',
              referenceId: subOrder.id,
              description: `Platform commission for subOrder ${subOrder.id}`,
            },
          ],
          now,
        )

        tx.update(subOrderRef, {
          commissionPaise,
          tcsPaise: Math.max(0, tcsPaise),
          tdsPaise: Math.max(0, tdsPaise),
          netPayableToSellerPaise,
          payoutId: null,
          updatedAt: now,
        })

        if (isCodOrder) {
          const allSettled = siblingSnapshots.every((snapshot) => {
            const status = snapshot.data()?.status as string | undefined
            return status !== undefined && SETTLED_SUB_ORDER_STATUSES.has(status)
          })
          if (allSettled) {
            tx.update(db.collection('orders').doc(order.id), { paymentStatus: 'paid', updatedAt: now })
          }
        }
      })
    } catch (error) {
      logger.error('applyCommissionOnDelivered: failed', {
        subOrderId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  },
)
