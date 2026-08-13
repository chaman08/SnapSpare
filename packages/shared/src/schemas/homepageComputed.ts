import { z } from 'zod'
import { listingIdSchema } from '../ids'
import { epochMsSchema } from './common'

/**
 * Growth module (Phase 20) — server-computed homepage data too expensive to
 * aggregate client-side. `homepageComputed/bulkBuySpotlight` is written daily
 * by computeBulkBuySpotlight.ts, which ranks every active listing by its
 * deepest quantity-slab discount (base tier price vs. cheapest bulk tier
 * price) so the "biggest slab savings" claim is always genuinely true rather
 * than an admin's guess.
 */
export const bulkBuySpotlightDocSchema = z.object({
  listingIds: z.array(listingIdSchema),
  computedAt: epochMsSchema,
})
export type BulkBuySpotlightDoc = z.infer<typeof bulkBuySpotlightDocSchema>
