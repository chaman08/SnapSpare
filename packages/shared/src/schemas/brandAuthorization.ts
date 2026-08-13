import { z } from 'zod'
import { makeFirestoreConverter } from '../firestore/converter'
import { brandAuthorizationIdSchema, sellerIdSchema, userIdSchema } from '../ids'
import { epochMsSchema } from './common'

export const brandAuthorizationStatusSchema = z.enum(['pending', 'verified', 'rejected'])
export type BrandAuthorizationStatus = z.infer<typeof brandAuthorizationStatusSchema>

/**
 * A seller's uploaded proof of authorization to sell a given brand's genuine
 * parts. Never award a "Genuine part" badge without one of these reaching
 * `status: 'verified'` — see functions/src/listings/persistListing.ts (badge
 * computed at listing-save time) and
 * functions/src/trust/onBrandAuthorizationWrite.ts (recomputes existing
 * listings' badges when an authorization is verified/revoked).
 */
export const brandAuthorizationSchema = z.object({
  id: brandAuthorizationIdSchema,
  sellerId: sellerIdSchema,
  brandName: z.string().min(1),
  /** Optional scope — when set, the badge only applies to listings whose catalogPart.categorySlug is in this list. Absent means the authorization covers every category for this brand. */
  categorySlugs: z.array(z.string()).optional(),
  documentUrl: z.string().min(1),
  status: brandAuthorizationStatusSchema,
  verifiedAt: epochMsSchema.optional(),
  verifiedBy: userIdSchema.optional(),
  rejectedReason: z.string().optional(),
  createdAt: epochMsSchema,
  updatedAt: epochMsSchema,
})
export type BrandAuthorization = z.infer<typeof brandAuthorizationSchema>

export const brandAuthorizationConverter = makeFirestoreConverter(brandAuthorizationSchema)

export const submitBrandAuthorizationRequestSchema = brandAuthorizationSchema.pick({
  brandName: true,
  categorySlugs: true,
  documentUrl: true,
})
export type SubmitBrandAuthorizationRequest = z.infer<typeof submitBrandAuthorizationRequestSchema>

export const reviewBrandAuthorizationRequestSchema = z.discriminatedUnion('decision', [
  z.object({ id: brandAuthorizationIdSchema, decision: z.literal('verified') }),
  z.object({ id: brandAuthorizationIdSchema, decision: z.literal('rejected'), rejectedReason: z.string().min(1) }),
])
export type ReviewBrandAuthorizationRequest = z.infer<typeof reviewBrandAuthorizationRequestSchema>
