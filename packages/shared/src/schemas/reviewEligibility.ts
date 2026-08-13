import { z } from 'zod'
import { makeFirestoreConverter } from '../firestore/converter'
import { listingIdSchema, orderIdSchema, partIdSchema, subOrderIdSchema, userIdSchema } from '../ids'
import { epochMsSchema } from './common'

/** The garage vehicle active (see activeVehicleStore) when the reviewed listing was added to cart — denormalized all the way from the cart line so the review form can auto-fill "Fitted to: X" without asking the buyer again. Absent when the buyer had no active vehicle selected. */
export const reviewVehicleFittedSchema = z.object({
  vehicleId: z.string().min(1),
  label: z.string().min(1),
})
export type ReviewVehicleFitted = z.infer<typeof reviewVehicleFittedSchema>

/**
 * Internal gate collection, id `${buyerId}_${listingId}`, written only by the
 * Cloud Function that reacts to a subOrder turning 'delivered'. It exists so
 * firestore.rules can authorize a buyer-authored `reviews` create without
 * trusting any field the buyer's own write supplies — the rule reads this
 * document (via `get()`, which bypasses rules for the read performed by the
 * rule engine itself) instead of taking the client's word for eligibility.
 * Never read or written directly by client code.
 */
export const reviewEligibilitySchema = z.object({
  id: z.string().min(1),
  buyerId: userIdSchema,
  listingId: listingIdSchema,
  partId: partIdSchema,
  orderId: orderIdSchema,
  subOrderId: subOrderIdSchema,
  eligible: z.boolean(),
  vehicleFitted: reviewVehicleFittedSchema.optional(),
  /** Explicitly `null` (not merely absent) from creation, set to a real timestamp once sendReviewRequests.ts queues the 3-days-after-delivery WhatsApp reminder — the explicit null lets that function's `where('reminderSentAt', '==', null)` query find it (Firestore can't match a genuinely-missing field), same idiom as subOrder.payoutId. */
  reminderSentAt: epochMsSchema.nullable().optional(),
  createdAt: epochMsSchema,
})
export type ReviewEligibility = z.infer<typeof reviewEligibilitySchema>

export const reviewEligibilityConverter = makeFirestoreConverter(reviewEligibilitySchema)
