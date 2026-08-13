import { type SchedulePickupResult, schedulePickupRequestSchema } from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { requireSellerId } from '../orders/authz.js'
import { loadSubOrderContext } from '../orders/loadContext.js'
import { provider } from './provider.js'

/** Schedules the courier pickup for an already-booked shipment (design brief item 5). */
export const schedulePickup = onCall({ enforceAppCheck: true, region: 'asia-south1' }, async (request): Promise<SchedulePickupResult> => {
  const sellerId = requireSellerId(request)
  const parsed = schedulePickupRequestSchema.safeParse(request.data)
  if (!parsed.success) throw new HttpsError('invalid-argument', 'A valid subOrderId and pickupDate are required')

  const db = getFirestore()
  const ctx = await db.runTransaction((tx) => loadSubOrderContext(tx, db, parsed.data.subOrderId))
  if (ctx.subOrder.sellerId !== sellerId) throw new HttpsError('permission-denied', 'not_your_suborder')
  const providerShipmentId = ctx.subOrder.shipment?.providerShipmentId
  if (!providerShipmentId) throw new HttpsError('failed-precondition', 'shipment_not_booked')

  const result = await provider.schedulePickup({ providerShipmentId, pickupDate: parsed.data.pickupDate })

  await ctx.subOrderRef.update({
    shipment: {
      ...ctx.subOrder.shipment,
      pickupScheduledAt: result.pickupScheduledAt,
      pickupDate: parsed.data.pickupDate,
    },
    updatedAt: Date.now(),
  })

  return { subOrderId: ctx.subOrder.id, pickupScheduledAt: result.pickupScheduledAt, pickupDate: parsed.data.pickupDate }
})
