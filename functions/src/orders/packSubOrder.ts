import { isSubOrderTransitionAllowed, type SubOrderActionResult, subOrderIdRequestSchema } from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { requireSellerId } from './authz.js'
import { loadSubOrderContext } from './loadContext.js'
import { queueNotification } from './notify.js'
import { appendTimelineEntry } from './timeline.js'

/** Seller marks an accepted subOrder as packed and ready to hand to the courier: `accepted` -> `packed`. */
export const packSubOrder = onCall({ enforceAppCheck: true, region: 'asia-south1' }, async (request): Promise<SubOrderActionResult> => {
  const sellerId = requireSellerId(request)
  const parsed = subOrderIdRequestSchema.safeParse(request.data)
  if (!parsed.success) throw new HttpsError('invalid-argument', 'A valid subOrderId is required')

  const db = getFirestore()
  return db.runTransaction(async (tx) => {
    const ctx = await loadSubOrderContext(tx, db, parsed.data.subOrderId)
    if (ctx.subOrder.sellerId !== sellerId) throw new HttpsError('permission-denied', 'not_your_suborder')
    if (!isSubOrderTransitionAllowed(ctx.subOrder.status, 'packed', 'seller')) {
      throw new HttpsError('failed-precondition', 'invalid_transition')
    }

    const now = Date.now()
    tx.update(ctx.subOrderRef, {
      status: 'packed',
      timeline: appendTimelineEntry(ctx.subOrder.timeline, 'packed', { type: 'seller', id: sellerId }, undefined, now),
      updatedAt: now,
    })
    queueNotification(tx, db, {
      userId: ctx.subOrder.buyerId,
      type: 'suborder_packed',
      language: ctx.buyerLanguage,
      orderId: ctx.order.id,
      subOrderId: ctx.subOrder.id,
    })

    return { subOrderId: ctx.subOrder.id, status: 'packed' }
  })
})
