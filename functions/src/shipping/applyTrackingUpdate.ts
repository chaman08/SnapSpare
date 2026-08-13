import { isSubOrderTransitionAllowed, subOrderSchema } from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import { queueNotification } from '../orders/notify.js'
import { appendTimelineEntry } from '../orders/timeline.js'
import { processRtoRefund } from './processRtoRefund.js'
import { mapProviderStatus } from './statusMapping.js'

/**
 * The single place a raw provider tracking status is interpreted, used by
 * both shiprocketWebhook.ts (push) and reconcileAwbTracking.ts (poll) so
 * the two paths can never disagree about what a status change means. A
 * no-op (besides recording `lastTrackedStatus`) when the mapped outcome
 * doesn't apply — e.g. a forward transition the subOrder can no longer
 * make, or a repeat of the same status already recorded.
 */
export async function applyTrackingUpdate(subOrderId: string, rawProviderStatus: string): Promise<void> {
  const db = getFirestore()
  const subOrderRef = db.collection('subOrders').doc(subOrderId)

  const outcome = mapProviderStatus(rawProviderStatus)

  const result = await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(subOrderRef)
    if (!snapshot.exists) return undefined
    const subOrder = subOrderSchema.parse({ id: snapshot.id, ...snapshot.data() })

    if (subOrder.shipment?.lastTrackedStatus === rawProviderStatus) {
      return undefined
    }
    const buyerSnapshot = await tx.get(db.collection('users').doc(subOrder.buyerId))
    const buyerLanguage = buyerSnapshot.exists && buyerSnapshot.data()?.preferredLanguage === 'hi' ? 'hi' : 'en'
    const now = Date.now()

    if (outcome.kind === 'transition') {
      if (!isSubOrderTransitionAllowed(subOrder.status, outcome.status, 'system')) {
        tx.update(subOrderRef, { 'shipment.lastTrackedStatus': rawProviderStatus, 'shipment.lastTrackedAt': now })
        return undefined
      }
      const shipmentUpdate =
        outcome.status === 'delivered' ? { 'shipment.deliveredAt': now } : {}
      tx.update(subOrderRef, {
        status: outcome.status,
        ...shipmentUpdate,
        'shipment.lastTrackedStatus': rawProviderStatus,
        'shipment.lastTrackedAt': now,
        timeline: appendTimelineEntry(subOrder.timeline, outcome.status, { type: 'system' }, undefined, now),
        updatedAt: now,
      })
      queueNotification(tx, db, {
        userId: subOrder.buyerId,
        type: outcome.status === 'delivered' ? 'suborder_delivered' : 'suborder_out_for_delivery',
        language: buyerLanguage,
        orderId: subOrder.orderId,
        subOrderId: subOrder.id,
      })
      return { kind: 'transition' as const }
    }

    if (outcome.kind === 'ndr') {
      const previousAttempts = subOrder.shipment?.ndr?.attempts ?? 0
      tx.update(subOrderRef, {
        'shipment.lastTrackedStatus': rawProviderStatus,
        'shipment.lastTrackedAt': now,
        'shipment.ndr': {
          status: 'raised',
          reasonCode: outcome.reasonCode,
          attempts: previousAttempts + 1,
          raisedAt: now,
        },
        timeline: appendTimelineEntry(subOrder.timeline, 'ndr_raised', { type: 'system' }, outcome.reasonCode, now),
        updatedAt: now,
      })
      queueNotification(tx, db, {
        userId: subOrder.buyerId,
        type: 'suborder_ndr_raised',
        language: buyerLanguage,
        orderId: subOrder.orderId,
        subOrderId: subOrder.id,
      })
      return { kind: 'ndr' as const }
    }

    // rto_delivered
    tx.update(subOrderRef, { 'shipment.lastTrackedStatus': rawProviderStatus, 'shipment.lastTrackedAt': now })
    return { kind: 'rto_delivered' as const }
  })

  if (result?.kind === 'rto_delivered') {
    try {
      await processRtoRefund(subOrderId)
    } catch (error) {
      logger.error('applyTrackingUpdate: processRtoRefund failed', {
        subOrderId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
}
