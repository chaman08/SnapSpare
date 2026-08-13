import { z } from 'zod'
import { listingIdSchema, sellerIdSchema } from '../ids'

/** Listings module price-anomaly report row (design brief item 5). "Far above/below market" is approximated against the listing's own declared `mrpPaise` (no cross-seller market-price aggregation exists yet) — see getListingAnomalyReport.ts for the exact thresholds. */
export const priceAnomalyRowSchema = z.object({
  listingId: listingIdSchema,
  sellerId: sellerIdSchema,
  title: z.string(),
  mrpPaise: z.number().int().nonnegative(),
  lowestTierUnitPricePaise: z.number().int().nonnegative(),
  ratioToMrp: z.number(),
  direction: z.enum(['above', 'below']),
})
export type PriceAnomalyRow = z.infer<typeof priceAnomalyRowSchema>

export const outOfStockRowSchema = z.object({
  listingId: listingIdSchema,
  sellerId: sellerIdSchema,
  title: z.string(),
  updatedAt: z.number().int().nonnegative(),
})
export type OutOfStockRow = z.infer<typeof outOfStockRowSchema>

export const getListingAnomalyReportResultSchema = z.object({
  priceAnomalies: z.array(priceAnomalyRowSchema),
  outOfStock: z.array(outOfStockRowSchema),
})
export type GetListingAnomalyReportResult = z.infer<typeof getListingAnomalyReportResultSchema>
