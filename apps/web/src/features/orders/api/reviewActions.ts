import type { ReviewVehicleFitted } from '@snapspare/shared'
import { reviewEligibilityConverter, reviewSchema } from '@snapspare/shared'
import { addDoc, collection, doc, getDoc } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

export interface SubmitReviewInput {
  orderId: string
  subOrderId: string
  listingId: string
  partId: string
  sellerId: string
  buyerId: string
  buyerDisplayName?: string
  rating: number
  fitmentAccurate: boolean
  qualityRating: number
  valueRating: number
  title?: string
  comment?: string
  images: string[]
  vehicleFitted?: ReviewVehicleFitted
}

/**
 * Direct client create, same as the original Phase-6 scaffold — firestore.rules'
 * reviews `create` rule is what actually authorizes this (verifiedPurchase,
 * status=='pending', and now also partId/vehicleFitted pinned equal to the
 * reviewEligibility gate doc, see review.ts's doc comment). The Cloud
 * Function trigger onReviewWrite.ts screens content and auto-publishes/flags
 * it right after this write lands.
 */
export async function submitReview(input: SubmitReviewInput): Promise<void> {
  const payload = reviewSchema
    .omit({ id: true, status: true, moderationStatus: true, moderationFlags: true, createdAt: true, updatedAt: true })
    .parse({
      ...input,
      verifiedPurchase: true,
    })
  const now = Date.now()
  await addDoc(collection(db, 'reviews'), {
    ...payload,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  })
}

/** Reads the reviewEligibility gate doc for `${buyerId}_${listingId}` — used to pre-fill the review form's auto-filled vehicle/part context and to know whether the buyer is even allowed to review yet. */
export async function getReviewEligibility(buyerId: string, listingId: string) {
  const snapshot = await getDoc(
    doc(db, 'reviewEligibility', `${buyerId}_${listingId}`).withConverter(clientConverter(reviewEligibilityConverter)),
  )
  return snapshot.exists() ? snapshot.data() : null
}

interface RespondToReviewRequest {
  reviewId: string
  comment: string
}

const respondToReviewCallable = httpsCallable<RespondToReviewRequest, { ok: true }>(functions, 'respondToReview')

export const respondToReview = (request: RespondToReviewRequest) => respondToReviewCallable(request).then((r) => r.data)

/** Maps a review/Q&A-adjacent callable failure to an i18n key under `reviews.errors.*`. */
export function mapReviewErrorToI18nKey(error: unknown): string {
  const message = (error as { message?: string } | null)?.message ?? ''
  switch (message) {
    case 'not_your_review':
      return 'reviews.errors.permissionDenied'
    case 'reply_already_posted':
      return 'reviews.errors.replyAlreadyPosted'
    case 'review_not_found':
      return 'reviews.errors.notFound'
    default:
      return 'reviews.errors.generic'
  }
}
