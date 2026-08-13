import { orderSchema, subOrderSchema } from '@snapspare/shared'
import { FieldValue, type Firestore, getFirestore } from 'firebase-admin/firestore'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { getCommissionConfig } from '../payments/commissionConfig.js'
import { postLedgerEntries, readLedger } from '../tax/ledger.js'
import { queueNotification } from './notify.js'
import { restoreStockInTx } from './stockOps.js'
import { appendTimelineEntry } from './timeline.js'

const BATCH_SIZE = 50

/**
 * Cancels any subOrder the seller didn't accept within their SLA window
 * (`config/app.sellerAcceptSlaHours`, wired into `slaAcceptByAt` at order
 * confirmation — see checkout/paymentTransition.ts and
 * checkout/createOrder.ts), restores its stock, and records an SLA breach
 * for seller scorecarding. Runs every 15 minutes — coarser than
 * releaseExpiredReservations' 5 minutes since this window is hours, not
 * minutes, so a little slack doesn't matter. Skips a subOrder that's no
 * longer `pending` by the time its transaction runs (already accepted or
 * cancelled by a human in the meantime) — same re-check-inside-the-
 * transaction idempotency pattern as releaseReservationAndCancel.
 */
export const autoCancelUnacceptedSubOrders = onSchedule(
  { region: 'asia-south1', schedule: 'every 15 minutes' },
  async () => {
    const db = getFirestore()
    const now = Date.now()
    const [snapshot, commissionConfig] = await Promise.all([
      db.collection('subOrders').where('status', '==', 'pending').where('slaAcceptByAt', '<=', now).limit(BATCH_SIZE).get(),
      getCommissionConfig(),
    ])

    await Promise.all(snapshot.docs.map((doc) => autoCancelOne(db, doc.id, commissionConfig.slaBreachPenaltyPaise)))
  },
)

async function autoCancelOne(db: Firestore, subOrderId: string, slaBreachPenaltyPaise: number | undefined): Promise<void> {
  const subOrderRef = db.collection('subOrders').doc(subOrderId)

  await db.runTransaction(async (tx) => {
    const subOrderSnapshot = await tx.get(subOrderRef)
    if (!subOrderSnapshot.exists) return
    const subOrder = subOrderSchema.parse({ id: subOrderSnapshot.id, ...subOrderSnapshot.data() })
    if (subOrder.status !== 'pending') return

    const [orderSnapshot, buyerSnapshot] = await Promise.all([
      tx.get(db.collection('orders').doc(subOrder.orderId)),
      tx.get(db.collection('users').doc(subOrder.buyerId)),
    ])
    if (!orderSnapshot.exists) return
    const order = orderSchema.parse({ id: orderSnapshot.id, ...orderSnapshot.data() })
    const buyerLanguage = buyerSnapshot.exists && buyerSnapshot.data()?.preferredLanguage === 'hi' ? 'hi' : 'en'

    const now = Date.now()
    const ledgerRead =
      slaBreachPenaltyPaise !== undefined && slaBreachPenaltyPaise > 0 ? await readLedger(tx, db, subOrder.sellerId) : undefined

    restoreStockInTx(
      tx,
      db,
      subOrder.items.map((item) => ({ listingId: item.listingId, qty: item.qty })),
      now,
      { sellerId: subOrder.sellerId, reason: 'correction', referenceId: subOrder.id },
    )
    if (ledgerRead && slaBreachPenaltyPaise !== undefined) {
      postLedgerEntries(
        tx,
        db,
        ledgerRead,
        subOrder.sellerId,
        [
          {
            type: 'penalty',
            direction: 'debit',
            amountPaise: slaBreachPenaltyPaise,
            referenceType: 'subOrder',
            referenceId: subOrder.id,
            description: 'SLA breach penalty — seller did not accept within the accept window',
          },
        ],
        now,
      )
    }
    tx.update(subOrderRef, {
      status: 'cancelled',
      slaBreached: true,
      slaAcceptByAt: FieldValue.delete(),
      timeline: appendTimelineEntry(
        subOrder.timeline,
        'cancelled',
        { type: 'system' },
        'Auto-cancelled: seller did not accept within the SLA window',
        now,
      ),
      updatedAt: now,
    })

    // The slaBreaches record (not a push notification) is the seller-facing
    // signal here — it feeds the seller performance scorecard a later phase
    // builds; only the buyer gets an immediate notification.
    tx.set(db.collection('slaBreaches').doc(), {
      sellerId: subOrder.sellerId,
      orderId: subOrder.orderId,
      subOrderId: subOrder.id,
      acceptByAt: subOrder.slaAcceptByAt ?? now,
      breachedAt: now,
      createdAt: now,
    })

    queueNotification(tx, db, {
      userId: subOrder.buyerId,
      type: 'suborder_sla_breached',
      language: buyerLanguage,
      orderId: order.id,
      subOrderId: subOrder.id,
    })
  })
}
