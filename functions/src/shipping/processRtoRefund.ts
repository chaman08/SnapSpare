import { orderSchema, returnSchema, subOrderSchema } from '@snapspare/shared'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import { getReturnsConfig } from '../orders/returnsConfig.js'
import { queueNotification } from '../orders/notify.js'
import { restoreStockInTx } from '../orders/stockOps.js'
import { appendTimelineEntry } from '../orders/timeline.js'
import { executeRefund } from '../payments/refundEngine.js'

/**
 * Runs once tracking confirms a courier has returned an undelivered parcel
 * to the seller (design brief item 7's RTO flow) — restores stock, closes
 * out the subOrder/return the same way a seller-approved return does
 * (refundReturn.ts), and refunds via functions/src/payments/refundEngine.ts
 * once the transaction commits. Called only from applyTrackingUpdate.ts.
 *
 * An RTO'd COD order never actually collected cash (delivery — where COD
 * cash is collected — never happened), so refundEngine's `cod` branch is a
 * no-op here regardless; only prepaid/credit_line orders have anything to
 * reverse.
 */
export async function processRtoRefund(subOrderId: string): Promise<void> {
  const db = getFirestore()
  const subOrderRef = db.collection('subOrders').doc(subOrderId)
  const returnsConfig = await getReturnsConfig()

  const outcome = await db.runTransaction(async (tx) => {
    const subOrderSnapshot = await tx.get(subOrderRef)
    if (!subOrderSnapshot.exists) return undefined
    const subOrder = subOrderSchema.parse({ id: subOrderSnapshot.id, ...subOrderSnapshot.data() })
    // Already resolved (a duplicate webhook delivery, or the reconciliation
    // sweep re-tracking an AWB it already processed) — nothing further to do.
    if (subOrder.status === 'returned' || subOrder.status === 'refunded' || subOrder.status === 'cancelled') {
      return undefined
    }

    const orderRef = db.collection('orders').doc(subOrder.orderId)
    const [orderSnapshot, buyerSnapshot] = await Promise.all([
      tx.get(orderRef),
      tx.get(db.collection('users').doc(subOrder.buyerId)),
    ])
    if (!orderSnapshot.exists) return undefined
    const order = orderSchema.parse({ id: orderSnapshot.id, ...orderSnapshot.data() })
    const buyerLanguage = buyerSnapshot.exists && buyerSnapshot.data()?.preferredLanguage === 'hi' ? 'hi' : 'en'

    const now = Date.now()
    const actor = { type: 'system' as const }

    // Buyer-abuse control (design brief item 8): every RTO counts against
    // the buyer, and crossing the configured threshold auto-sets the
    // existing codAbuseFlag — reusing checkout's COD gate (createOrder.ts/
    // acceptRfqQuote.ts) rather than inventing a new one.
    const currentRtoCount = (buyerSnapshot.exists ? (buyerSnapshot.data()?.rtoCount as number | undefined) : undefined) ?? 0
    const nextRtoCount = currentRtoCount + 1
    if (buyerSnapshot.exists) {
      tx.update(buyerSnapshot.ref, {
        rtoCount: nextRtoCount,
        ...(nextRtoCount >= returnsConfig.rtoAutoCodBlockThreshold ? { codAbuseFlag: true } : {}),
        updatedAt: now,
      })
    }

    restoreStockInTx(tx, db, subOrder.items.map((item) => ({ listingId: item.listingId, qty: item.qty })), now, {
      sellerId: subOrder.sellerId,
      reason: 'return',
      referenceId: subOrder.id,
    })

    // One return doc per line item — a multi-line subOrder gets several,
    // each scoped to one listing, consistent with returnSchema's
    // one-listing shape (same shape refundReturn.ts produces per call).
    // The first one's id is what's passed to executeRefund as the
    // representative returnId (used only for gateway-refund audit notes —
    // RTO always refunds the whole subOrder in one shot, never partially).
    let primaryReturnId: string | undefined
    for (const item of subOrder.items) {
      const returnRef = db.collection('returns').doc()
      if (!primaryReturnId) primaryReturnId = returnRef.id
      const { id: _id, ...returnDoc } = returnSchema.parse({
        id: returnRef.id,
        orderId: order.id,
        subOrderId: subOrder.id,
        buyerId: subOrder.buyerId,
        sellerId: subOrder.sellerId,
        listingId: item.listingId,
        qty: item.qty,
        reason: 'rto_undelivered',
        resolutionPreference: 'refund',
        status: 'refunded',
        refundAmountPaise: item.lineTotalPaise,
        images: [],
        timeline: appendTimelineEntry([], 'refunded', actor, 'RTO — undelivered after repeated attempts', now),
        requestedAt: now,
        resolvedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      tx.set(returnRef, returnDoc)
    }

    tx.update(subOrderRef, {
      status: 'returned',
      slaAcceptByAt: FieldValue.delete(),
      timeline: appendTimelineEntry(subOrder.timeline, 'returned', actor, 'RTO — undelivered after repeated attempts', now),
      updatedAt: now,
    })

    queueNotification(tx, db, {
      userId: subOrder.buyerId,
      type: 'suborder_rto_refunded',
      language: buyerLanguage,
      orderId: order.id,
      subOrderId: subOrder.id,
    })

    return { order, subOrder, primaryReturnId }
  })

  if (!outcome) return
  const { order, subOrder, primaryReturnId } = outcome

  try {
    await executeRefund({
      orderId: order.id,
      subOrderId: subOrder.id,
      items: subOrder.items.map((item) => ({ listingId: item.listingId, qty: item.qty })),
      returnId: primaryReturnId,
      reason: 'rto_undelivered',
    })
  } catch (error) {
    logger.error('processRtoRefund: refund failed', {
      subOrderId: subOrder.id,
      orderId: order.id,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
