import { z } from 'zod'
import { makeFirestoreConverter } from '../firestore/converter'
import {
  listingIdSchema,
  orderIdSchema,
  partIdSchema,
  reviewIdSchema,
  sellerIdSchema,
  subOrderIdSchema,
  userIdSchema,
} from '../ids'
import { epochMsSchema } from './common'
import { reviewVehicleFittedSchema } from './reviewEligibility'

export const MAX_REVIEW_IMAGES = 4

export const sellerReplySchema = z.object({
  comment: z.string().min(1),
  repliedAt: epochMsSchema,
})
export type SellerReply = z.infer<typeof sellerReplySchema>

export const reviewSchema = z.object({
  id: reviewIdSchema,
  orderId: orderIdSchema,
  subOrderId: subOrderIdSchema,
  listingId: listingIdSchema,
  /** Denormalized at create time, pinned equal to reviewEligibility's own partId by firestore.rules — lets rating aggregation (onReviewWrite.ts) recompute a part-level rating without joining through the listing. */
  partId: partIdSchema,
  sellerId: sellerIdSchema,
  buyerId: userIdSchema,
  /** Denormalised at review-creation time (first name only) — reviews are public (see firestore.rules), but `users/{id}` is locked to the owner/admin, so this is the only way a review can show who wrote it. Absent on older/unset reviews; display falls back to a generic "Verified buyer" label. */
  buyerDisplayName: z.string().optional(),
  /** Overall star rating. Fitment accuracy, quality and value are separate axes below — displaying "Fitted to: X" is worth more to a buyer than this number alone. */
  rating: z.number().int().min(1).max(5),
  /** Did the part actually fit the vehicle in `vehicleFitted`? Feeds fitment-quality aggregate counters on the listing (see listingSchema's fitmentAccurateCount/fitmentInaccurateCount) — never auto-mutates the admin-verified catalogFitments data itself. */
  fitmentAccurate: z.boolean(),
  qualityRating: z.number().int().min(1).max(5),
  valueRating: z.number().int().min(1).max(5),
  title: z.string().optional(),
  comment: z.string().optional(),
  images: z.array(z.string().url()).max(MAX_REVIEW_IMAGES).default([]),
  /** Denormalized from reviewEligibility at create time, pinned by firestore.rules — the garage vehicle this listing was bought for, if any. */
  vehicleFitted: reviewVehicleFittedSchema.optional(),
  sellerReply: sellerReplySchema.optional(),
  /**
   * Set only by the reviewEligibility check at create time (never
   * client-editable afterward) — true means a Cloud Function confirmed a
   * delivered subOrder containing this listing for this buyer.
   */
  verifiedPurchase: z.boolean().default(false),
  status: z.enum(['published', 'pending', 'hidden']),
  /** Automated profanity/contact-info/PII screen result — see functions/src/reviews/onReviewWrite.ts. 'flagged' + status still 'pending' is what the admin moderation queue filters on. */
  moderationStatus: z.enum(['clean', 'flagged']).default('clean'),
  moderationFlags: z.array(z.string()).default([]),
  reviewedBy: userIdSchema.optional(),
  reviewedAt: epochMsSchema.optional(),
  adminNotes: z.string().optional(),
  createdAt: epochMsSchema,
  updatedAt: epochMsSchema,
})
export type Review = z.infer<typeof reviewSchema>

export const reviewConverter = makeFirestoreConverter(reviewSchema)
