import { subOrderSchema } from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import { onDocumentWritten } from 'firebase-functions/v2/firestore'
import { stripUndefined } from '../util/stripUndefined.js'

/**
 * The moment a subOrder becomes 'delivered', writes one
 * `reviewEligibility/{buyerId}_{listingId}` doc per line item — this is the
 * only thing that unlocks firestore.rules' `hasReviewEligibility()` check
 * for the `reviews` collection create rule (see review.ts's doc comment).
 * Runs independently of sendReviewRequests.ts's 3-day WhatsApp reminder so a
 * buyer can review immediately without waiting for the nudge.
 */
export const onSubOrderDeliveredReviewEligibility = onDocumentWritten(
  { document: 'subOrders/{subOrderId}', region: 'asia-south1' },
  async (event) => {
    const before = event.data?.before.exists ? event.data.before.data() : undefined
    const after = event.data?.after.exists ? event.data.after.data() : undefined
    if (!after || before?.status === after.status || after.status !== 'delivered') return

    const parsed = subOrderSchema.safeParse({ id: event.params.subOrderId, ...after })
    if (!parsed.success) {
      logger.error('onSubOrderDeliveredReviewEligibility: subOrder doc failed schema validation', {
        subOrderId: event.params.subOrderId,
        issues: parsed.error.issues,
      })
      return
    }
    const subOrder = parsed.data
    const db = getFirestore()
    const now = Date.now()

    const batch = db.batch()
    for (const item of subOrder.items) {
      const ref = db.collection('reviewEligibility').doc(`${subOrder.buyerId}_${item.listingId}`)
      batch.set(
        ref,
        stripUndefined({
          buyerId: subOrder.buyerId,
          listingId: item.listingId,
          partId: item.partId,
          orderId: subOrder.orderId,
          subOrderId: subOrder.id,
          eligible: true,
          // Explicitly null (not merely absent) so sendReviewRequests.ts's
          // `where('reminderSentAt', '==', null)` — which cannot match a
          // genuinely-missing field — finds it. Same idiom as subOrder.payoutId.
          reminderSentAt: null,
          vehicleFitted:
            item.vehicleId && item.vehicleLabel
              ? { vehicleId: item.vehicleId, label: item.vehicleLabel }
              : undefined,
          createdAt: now,
        }),
      )
    }
    await batch.commit()
  },
)
