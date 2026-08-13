import { cancelShipmentRequestSchema, type SubOrderActionResult } from '@snapspare/shared'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { isAdminRequest, requireUid } from '../orders/authz.js'
import { loadSubOrderContext } from '../orders/loadContext.js'
import { writeAuditLog } from '../util/auditLog.js'
import { provider } from './provider.js'

/** Cancels a booked-but-not-yet-shipped courier shipment. Seller or admin only. */
export const cancelShipment = onCall({ enforceAppCheck: true, region: 'asia-south1' }, async (request): Promise<SubOrderActionResult> => {
  requireUid(request)
  const sellerId = request.auth?.token.sellerId as string | undefined
  const admin = isAdminRequest(request)

  const parsed = cancelShipmentRequestSchema.safeParse(request.data)
  if (!parsed.success) throw new HttpsError('invalid-argument', 'A valid subOrderId is required')

  const db = getFirestore()
  const ctx = await db.runTransaction((tx) => loadSubOrderContext(tx, db, parsed.data.subOrderId))
  if (!admin && ctx.subOrder.sellerId !== sellerId) throw new HttpsError('permission-denied', 'not_your_suborder')
  const providerShipmentId = ctx.subOrder.shipment?.providerShipmentId
  if (!providerShipmentId) throw new HttpsError('failed-precondition', 'shipment_not_booked')

  await provider.cancelShipment(providerShipmentId)

  await ctx.subOrderRef.update({
    'shipment.providerShipmentId': FieldValue.delete(),
    'shipment.providerOrderId': FieldValue.delete(),
    updatedAt: Date.now(),
  })
  if (admin) {
    await writeAuditLog({
      request,
      action: 'shipment.cancel',
      targetType: 'subOrders',
      targetId: ctx.subOrder.id,
      before: { providerShipmentId },
    })
  }

  return { subOrderId: ctx.subOrder.id, status: ctx.subOrder.status }
})
