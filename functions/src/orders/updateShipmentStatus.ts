import {
  isSubOrderTransitionAllowed,
  type SubOrderActionResult,
  updateShipmentStatusRequestSchema,
} from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { isAdminRequest, requireUid } from './authz.js'
import { loadSubOrderContext } from './loadContext.js'
import { queueNotification } from './notify.js'
import { appendTimelineEntry } from './timeline.js'
import { writeAuditLog } from '../util/auditLog.js'

/**
 * `shipped` -> `out_for_delivery` -> `delivered`. Stand-in for the courier
 * tracking webhook a real Shiprocket integration would call automatically —
 * for now callable by the owning seller (marking their own shipment's
 * progress) or an admin (support correcting a stuck order). Setting
 * `delivered` here is what fires the existing
 * recommendation/onSubOrderDelivered.ts trigger (review eligibility +
 * co-occurrence counters) — untouched by this phase.
 */
export const updateShipmentStatus = onCall(
  { enforceAppCheck: true, region: 'asia-south1' },
  async (request): Promise<SubOrderActionResult> => {
    const uid = requireUid(request)
    const sellerId = request.auth?.token.sellerId as string | undefined
    const admin = isAdminRequest(request)

    const parsed = updateShipmentStatusRequestSchema.safeParse(request.data)
    if (!parsed.success) throw new HttpsError('invalid-argument', 'A valid subOrderId and status are required')

    const db = getFirestore()
    let previousStatus: string | undefined
    const result = await db.runTransaction(async (tx) => {
      const ctx = await loadSubOrderContext(tx, db, parsed.data.subOrderId)
      if (!admin && ctx.subOrder.sellerId !== sellerId) {
        throw new HttpsError('permission-denied', 'not_your_suborder')
      }
      if (!isSubOrderTransitionAllowed(ctx.subOrder.status, parsed.data.status, admin ? 'admin' : 'seller')) {
        throw new HttpsError('failed-precondition', 'invalid_transition')
      }
      previousStatus = ctx.subOrder.status

      const now = Date.now()
      const actor = admin ? ({ type: 'admin', id: uid } as const) : ({ type: 'seller', id: sellerId } as const)
      const shipmentUpdate =
        parsed.data.status === 'delivered' ? { shipment: { ...ctx.subOrder.shipment, deliveredAt: now } } : {}

      tx.update(ctx.subOrderRef, {
        status: parsed.data.status,
        ...shipmentUpdate,
        timeline: appendTimelineEntry(ctx.subOrder.timeline, parsed.data.status, actor, undefined, now),
        updatedAt: now,
      })
      queueNotification(tx, db, {
        userId: ctx.subOrder.buyerId,
        type: parsed.data.status === 'delivered' ? 'suborder_delivered' : 'suborder_out_for_delivery',
        language: ctx.buyerLanguage,
        orderId: ctx.order.id,
        subOrderId: ctx.subOrder.id,
      })

      return { subOrderId: ctx.subOrder.id, status: parsed.data.status }
    })

    // Written outside the transaction — writeAuditLog is a separate
    // document write, not tx-bound, and calling it inside a transaction
    // callback would risk a duplicate entry if Firestore retries the
    // transaction on contention.
    if (admin) {
      await writeAuditLog({
        request,
        action: 'shipment.updateStatus',
        targetType: 'subOrders',
        targetId: result.subOrderId,
        before: { status: previousStatus },
        after: { status: result.status },
      })
    }

    return result
  },
)
