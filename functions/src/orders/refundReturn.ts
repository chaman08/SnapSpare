import { computeLineRefund, orderSchema, type RefundReturnResult, refundReturnRequestSchema, returnSchema, subOrderSchema } from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { isAdminRequest } from './authz.js'
import { queueNotification } from './notify.js'
import { restoreStockInTx } from './stockOps.js'
import { appendTimelineEntry } from './timeline.js'
import { executeRefund } from '../payments/refundEngine.js'
import { writeAuditLog } from '../util/auditLog.js'

/**
 * Finalizes an already-seller-approved return: computes the refund amount
 * server-side (proportional to the returned qty vs. the line's original
 * qty — including discount/tax reversal, via computeLineRefund — so a
 * partial-quantity return refunds a partial amount), restores stock, moves
 * the subOrder to `returned`, and the return doc to `refunded`. Callable by
 * the owning seller or an admin.
 *
 * For a COD order, a buyer must have submitted refund bank details first
 * (submitRefundBankDetails.ts) — there's no card/UPI instrument to reverse a
 * COD refund to, see functions/src/payments/refundEngine.ts's doc comment.
 *
 * Skips the `picked_up` intermediate status (no Shiprocket reverse-pickup
 * automation in this phase — a seller marks a return refunded once they've
 * physically received it back, however that happened). The actual
 * gateway/credit-line/bank-transfer refund call runs once this transaction
 * commits, via executeRefund — never inside the transaction itself (external
 * API calls must never run somewhere that might retry on contention).
 */
export const refundReturn = onCall({ enforceAppCheck: true, region: 'asia-south1' }, async (request): Promise<RefundReturnResult> => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required')
  const sellerId = request.auth.token.sellerId as string | undefined
  const admin = isAdminRequest(request)
  if (!sellerId && !admin) throw new HttpsError('permission-denied', 'seller_or_admin_only')

  const parsed = refundReturnRequestSchema.safeParse(request.data)
  if (!parsed.success) throw new HttpsError('invalid-argument', 'A valid returnId is required')

  const db = getFirestore()

  const result = await db.runTransaction(async (tx) => {
    const returnRef = db.collection('returns').doc(parsed.data.returnId)
    const returnSnapshot = await tx.get(returnRef)
    if (!returnSnapshot.exists) throw new HttpsError('not-found', 'return_not_found')
    const ret = returnSchema.parse({ id: returnSnapshot.id, ...returnSnapshot.data() })
    if (!admin && ret.sellerId !== sellerId) throw new HttpsError('permission-denied', 'not_your_return')
    if (ret.status !== 'approved') throw new HttpsError('failed-precondition', 'return_not_approved')

    const subOrderRef = db.collection('subOrders').doc(ret.subOrderId)
    const [subOrderSnapshot, orderSnapshot, buyerSnapshot] = await Promise.all([
      tx.get(subOrderRef),
      tx.get(db.collection('orders').doc(ret.orderId)),
      tx.get(db.collection('users').doc(ret.buyerId)),
    ])
    if (!subOrderSnapshot.exists) throw new HttpsError('failed-precondition', 'subOrder_not_found')
    if (!orderSnapshot.exists) throw new HttpsError('failed-precondition', 'order_not_found')
    const subOrder = subOrderSchema.parse({ id: subOrderSnapshot.id, ...subOrderSnapshot.data() })
    const order = orderSchema.parse({ id: orderSnapshot.id, ...orderSnapshot.data() })
    const item = subOrder.items.find((line) => line.listingId === ret.listingId)
    if (!item) throw new HttpsError('failed-precondition', 'item_not_in_suborder')

    if (order.paymentMethod === 'cod' && order.paymentStatus === 'paid') {
      const bankDetailSnapshot = await tx.get(
        db.collection('refundBankDetails').where('returnId', '==', ret.id).where('status', '==', 'pending').limit(1),
      )
      if (bankDetailSnapshot.empty) throw new HttpsError('failed-precondition', 'bank_details_required')
    }

    const refundAmountPaise = computeLineRefund(item, ret.qty).totalPaise
    const now = Date.now()
    const actor = admin ? { type: 'admin' as const, id: request.auth?.uid } : { type: 'seller' as const, id: sellerId }

    restoreStockInTx(tx, db, [{ listingId: ret.listingId, qty: ret.qty }], now, {
      sellerId: ret.sellerId,
      reason: 'return',
      actorId: actor.id,
      referenceId: ret.id,
    })
    tx.update(subOrderRef, {
      status: 'returned',
      timeline: appendTimelineEntry(subOrder.timeline, 'returned', actor, undefined, now),
      updatedAt: now,
    })
    tx.update(returnRef, {
      status: 'refunded',
      refundAmountPaise,
      resolvedAt: now,
      updatedAt: now,
    })

    const buyerLanguage = buyerSnapshot.exists && buyerSnapshot.data()?.preferredLanguage === 'hi' ? 'hi' : 'en'
    queueNotification(tx, db, {
      userId: ret.buyerId,
      type: 'return_refunded',
      language: buyerLanguage,
      orderId: ret.orderId,
      subOrderId: ret.subOrderId,
      returnId: ret.id,
    })

    return { returnId: ret.id, refundAmountPaise, orderId: ret.orderId, subOrderId: ret.subOrderId, listingId: ret.listingId, qty: ret.qty }
  })

  try {
    await executeRefund({
      orderId: result.orderId,
      subOrderId: result.subOrderId,
      items: [{ listingId: result.listingId, qty: result.qty }],
      returnId: result.returnId,
      reason: 'return',
    })
  } catch (error) {
    logger.error('refundReturn: refund failed', {
      returnId: result.returnId,
      error: error instanceof Error ? error.message : String(error),
    })
  }

  if (admin) {
    await writeAuditLog({
      request,
      action: 'return.refund',
      targetType: 'returns',
      targetId: result.returnId,
      after: { status: 'refunded', refundAmountPaise: result.refundAmountPaise },
    })
  }

  return { returnId: result.returnId, refundAmountPaise: result.refundAmountPaise }
})
