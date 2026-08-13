import {
  isSubOrderTransitionAllowed,
  type SubOrderActionResult,
  type SubOrderItem,
  subOrderIdRequestSchema,
} from '@snapspare/shared'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { requireSellerId } from './authz.js'
import { loadSubOrderContext } from './loadContext.js'
import { queueNotification } from './notify.js'
import { restoreStockInTx } from './stockOps.js'
import { appendTimelineEntry } from './timeline.js'
import { executeRefund } from '../payments/refundEngine.js'

/**
 * Seller declines a new subOrder before ever accepting it: `pending` ->
 * `rejected` (terminal — distinct from a post-acceptance `cancelled`, so
 * seller performance reporting can tell "never even tried" apart from
 * "accepted then couldn't fulfil"). Restores the stock that was committed
 * at order confirmation, then refunds the full subOrder via
 * functions/src/payments/refundEngine.ts once the transaction commits (same
 * two-phase shape as cancelSubOrder.ts).
 */
export const rejectSubOrder = onCall({ enforceAppCheck: true, region: 'asia-south1' }, async (request): Promise<SubOrderActionResult> => {
  const sellerId = requireSellerId(request)
  const parsed = subOrderIdRequestSchema.safeParse(request.data)
  if (!parsed.success) throw new HttpsError('invalid-argument', 'A valid subOrderId is required')

  const db = getFirestore()
  let orderId: string | undefined
  let refundItems: SubOrderItem[] = []

  const result = await db.runTransaction(async (tx) => {
    const ctx = await loadSubOrderContext(tx, db, parsed.data.subOrderId)
    if (ctx.subOrder.sellerId !== sellerId) throw new HttpsError('permission-denied', 'not_your_suborder')
    if (!isSubOrderTransitionAllowed(ctx.subOrder.status, 'rejected', 'seller')) {
      throw new HttpsError('failed-precondition', 'invalid_transition')
    }
    orderId = ctx.order.id
    refundItems = ctx.subOrder.items

    const now = Date.now()
    restoreStockInTx(
      tx,
      db,
      ctx.subOrder.items.map((item) => ({ listingId: item.listingId, qty: item.qty })),
      now,
      { sellerId: ctx.subOrder.sellerId, reason: 'correction', actorId: sellerId, referenceId: ctx.subOrder.id },
    )
    tx.update(ctx.subOrderRef, {
      status: 'rejected',
      slaAcceptByAt: FieldValue.delete(),
      timeline: appendTimelineEntry(ctx.subOrder.timeline, 'rejected', { type: 'seller', id: sellerId }, undefined, now),
      updatedAt: now,
    })
    queueNotification(tx, db, {
      userId: ctx.subOrder.buyerId,
      type: 'suborder_rejected',
      language: ctx.buyerLanguage,
      orderId: ctx.order.id,
      subOrderId: ctx.subOrder.id,
    })

    return { subOrderId: ctx.subOrder.id, status: 'rejected' as const }
  })

  if (orderId) {
    try {
      await executeRefund({
        orderId,
        subOrderId: result.subOrderId,
        items: refundItems.map((item) => ({ listingId: item.listingId, qty: item.qty })),
        reason: 'rejection',
      })
    } catch (error) {
      logger.error('rejectSubOrder: refund failed', {
        subOrderId: result.subOrderId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return result
})
