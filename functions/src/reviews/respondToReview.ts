import { z } from 'zod'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { requireSellerId } from '../orders/authz.js'
import { queueNotificationDirect } from '../orders/notify.js'
import { resolveUserLanguage } from '../seller/notifyLanguage.js'

const respondToReviewRequestSchema = z.object({
  reviewId: z.string().min(1),
  comment: z.string().min(1).max(2000),
})

/** A seller may respond to a review of their listing exactly once (design brief item 2) — a second attempt is rejected outright, not merged/appended. */
export const respondToReview = onCall({ enforceAppCheck: true, region: 'asia-south1' }, async (request): Promise<{ ok: true }> => {
  const sellerId = requireSellerId(request)

  const parsed = respondToReviewRequestSchema.safeParse(request.data)
  if (!parsed.success) throw new HttpsError('invalid-argument', 'A valid response is required')
  const input = parsed.data

  const db = getFirestore()
  const ref = db.collection('reviews').doc(input.reviewId)
  const snapshot = await ref.get()
  if (!snapshot.exists) throw new HttpsError('not-found', 'review_not_found')

  const review = snapshot.data() as { sellerId?: string; sellerReply?: unknown; buyerId?: string; listingId?: string }
  if (review.sellerId !== sellerId) throw new HttpsError('permission-denied', 'not_your_review')
  if (review.sellerReply) throw new HttpsError('already-exists', 'reply_already_posted')

  await ref.update({
    sellerReply: { comment: input.comment, repliedAt: Date.now() },
    updatedAt: Date.now(),
  })

  if (review.buyerId) {
    await queueNotificationDirect(db, {
      userId: review.buyerId,
      type: 'review_seller_reply',
      language: await resolveUserLanguage(db, review.buyerId),
      listingId: review.listingId,
      reviewId: input.reviewId,
    })
  }

  return { ok: true }
})
