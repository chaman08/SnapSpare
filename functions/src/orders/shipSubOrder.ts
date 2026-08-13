import {
  isSubOrderTransitionAllowed,
  shipSubOrderRequestSchema,
  type SubOrderActionResult,
} from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { requireSellerId } from './authz.js'
import { loadSubOrderContext } from './loadContext.js'
import { queueNotification } from './notify.js'
import { appendTimelineEntry } from './timeline.js'

/**
 * Seller hands the packed subOrder to a courier: `packed` -> `shipped`,
 * recording the AWB/courier the buyer needs to track it. `shiprocketOrderId`
 * is left unset — no real Shiprocket booking call is wired up in this
 * phase (see the PR notes); a future integration would create the
 * Shiprocket order first and pass its id through here.
 */
export const shipSubOrder = onCall({ enforceAppCheck: true, region: 'asia-south1' }, async (request): Promise<SubOrderActionResult> => {
  const sellerId = requireSellerId(request)
  const parsed = shipSubOrderRequestSchema.safeParse(request.data)
  if (!parsed.success) throw new HttpsError('invalid-argument', 'A valid subOrderId, awb and courier are required')

  const db = getFirestore()
  return db.runTransaction(async (tx) => {
    const ctx = await loadSubOrderContext(tx, db, parsed.data.subOrderId)
    if (ctx.subOrder.sellerId !== sellerId) throw new HttpsError('permission-denied', 'not_your_suborder')
    if (!isSubOrderTransitionAllowed(ctx.subOrder.status, 'shipped', 'seller')) {
      throw new HttpsError('failed-precondition', 'invalid_transition')
    }

    const now = Date.now()
    tx.update(ctx.subOrderRef, {
      status: 'shipped',
      shipment: { awb: parsed.data.awb, courier: parsed.data.courier, shippedAt: now },
      timeline: appendTimelineEntry(
        ctx.subOrder.timeline,
        'shipped',
        { type: 'seller', id: sellerId },
        `AWB ${parsed.data.awb} via ${parsed.data.courier}`,
        now,
      ),
      updatedAt: now,
    })
    queueNotification(tx, db, {
      userId: ctx.subOrder.buyerId,
      type: 'suborder_shipped',
      language: ctx.buyerLanguage,
      orderId: ctx.order.id,
      subOrderId: ctx.subOrder.id,
      copyInput: { awb: parsed.data.awb, courier: parsed.data.courier },
      data: { awb: parsed.data.awb, courier: parsed.data.courier },
    })

    return { subOrderId: ctx.subOrder.id, status: 'shipped' }
  })
})
