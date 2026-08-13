import { z } from 'zod'
import { makeFirestoreConverter } from '../firestore/converter'
import { listingIdSchema, sellerIdSchema } from '../ids'
import { callableRequestSchema, epochMsSchema } from './common'
import { groupPricingSchema, listingPricingSchema } from './listing'

export const pricingTemplateIdSchema = z.string().min(1)
export type PricingTemplateId = z.infer<typeof pricingTemplateIdSchema>

/**
 * A reusable ladder "shape" a seller can save once and apply to many
 * listings at once (requirement 3d — "standard 3-step 5/10%" etc.). Stores
 * the default ladder plus optional buyer-group overrides, exactly the same
 * shape a listing itself carries (`pricing` + `groupPricing`), so applying
 * a template is a straight copy onto the target listings, re-validated the
 * same way any other listing write is (see `persistListing.ts`).
 */
export const pricingTemplateSchema = z.object({
  id: pricingTemplateIdSchema,
  sellerId: sellerIdSchema,
  name: z.string().min(1).max(80),
  pricing: listingPricingSchema,
  groupPricing: groupPricingSchema.optional(),
  createdAt: epochMsSchema,
  updatedAt: epochMsSchema,
})
export type PricingTemplate = z.infer<typeof pricingTemplateSchema>

export const pricingTemplateConverter = makeFirestoreConverter(pricingTemplateSchema)

export const savePricingTemplateRequestSchema = callableRequestSchema(
  pricingTemplateSchema.omit({ id: true, sellerId: true, createdAt: true, updatedAt: true }).extend({
    id: pricingTemplateIdSchema.optional(),
  }),
)
export type SavePricingTemplateRequest = z.infer<typeof savePricingTemplateRequestSchema>

export const savePricingTemplateResultSchema = z.object({ id: pricingTemplateIdSchema })
export type SavePricingTemplateResult = z.infer<typeof savePricingTemplateResultSchema>

export const deletePricingTemplateRequestSchema = z.object({ id: pricingTemplateIdSchema })
export type DeletePricingTemplateRequest = z.infer<typeof deletePricingTemplateRequestSchema>

/**
 * Applies a saved template's ladder (and group overrides, if any) onto many
 * listings at once — each target listing is re-validated exactly like any
 * other `persistListing.ts` write; a listing that would end up invalid
 * (should never happen given the template itself is valid, but a listing's
 * `pricing.moq`/`stepQty` interact with the template's tiers) is skipped
 * and reported back, not partially applied.
 */
export const applyPricingTemplateRequestSchema = z.object({
  templateId: pricingTemplateIdSchema,
  listingIds: z.array(listingIdSchema).min(1).max(400),
})
export type ApplyPricingTemplateRequest = z.infer<typeof applyPricingTemplateRequestSchema>

export const applyPricingTemplateResultSchema = z.object({
  appliedListingIds: z.array(listingIdSchema),
  failedListingIds: z.array(listingIdSchema),
})
export type ApplyPricingTemplateResult = z.infer<typeof applyPricingTemplateResultSchema>
