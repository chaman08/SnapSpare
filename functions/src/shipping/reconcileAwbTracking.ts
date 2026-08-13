import { type SubOrder, subOrderSchema } from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { applyTrackingUpdate } from './applyTrackingUpdate.js'
import { provider } from './provider.js'

const BATCH_SIZE = 50

/**
 * Missed-webhook safety net (design brief item 6) — mirrors
 * checkout/releaseExpiredReservations.ts's shape. Polls every actively
 * in-transit subOrder's AWB and feeds the result through the same
 * applyTrackingUpdate.ts the webhook uses, so a subOrder whose
 * shiprocketWebhook delivery never arrived still eventually progresses.
 * `status in [...]` is a single-field filter — no composite index needed.
 */
export const reconcileAwbTracking = onSchedule({ region: 'asia-south1', schedule: 'every 30 minutes' }, async () => {
  const snapshot = await getFirestore()
    .collection('subOrders')
    .where('status', 'in', ['shipped', 'out_for_delivery'])
    .limit(BATCH_SIZE)
    .get()

  const withAwb: SubOrder[] = []
  for (const doc of snapshot.docs) {
    const parsed = subOrderSchema.safeParse({ id: doc.id, ...doc.data() })
    if (parsed.success && parsed.data.shipment?.awb) withAwb.push(parsed.data)
  }

  await Promise.allSettled(
    withAwb.map(async (subOrder) => {
      const awb = subOrder.shipment?.awb
      if (!awb) return
      try {
        const tracked = await provider.trackAwb(awb)
        if (tracked.status === subOrder.shipment?.lastTrackedStatus) return
        await applyTrackingUpdate(subOrder.id, tracked.status)
      } catch (error) {
        logger.warn('reconcileAwbTracking: trackAwb failed', {
          subOrderId: subOrder.id,
          awb,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }),
  )
})
