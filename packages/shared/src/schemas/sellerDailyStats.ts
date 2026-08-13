import { z } from 'zod'
import { makeFirestoreConverter } from '../firestore/converter'
import { listingIdSchema, partIdSchema, sellerIdSchema } from '../ids'
import { epochMsSchema } from './common'

export const sellerDailyTopPartSchema = z.object({
  partId: partIdSchema,
  listingId: listingIdSchema,
  title: z.string().min(1),
  qty: z.number().int().nonnegative(),
  revenuePaise: z.number().int().nonnegative(),
})
export type SellerDailyTopPart = z.infer<typeof sellerDailyTopPartSchema>

/**
 * One doc per seller per UTC calendar day (id = `${sellerId}_${date}`,
 * `date` = 'YYYY-MM-DD'), written once daily by rollupSellerDailyStats.ts —
 * a client-side scan of raw `subOrders` for a 90-day revenue chart doesn't
 * scale past a handful of orders, so this pre-aggregation is required
 * infra, not an optimization (requirement 6).
 *
 * `revenuePaise`/`unitsSold`/`topParts` count only subOrders NOT in
 * `cancelled`/`rejected` status as of rollup time, bucketed by the day the
 * order was PLACED (`createdAt`) — this is gross sales/order value
 * (`subOrder.totalPaise`), not `netPayableToSellerPaise` (only set at
 * delivery) and not payout timing, matching how sellers commonly read a
 * "today's sales" figure rather than settled cash. `ordersCount` counts
 * every subOrder placed that day regardless of eventual status.
 *
 * SLA fields count transitions that HAPPENED that day (via each subOrder's
 * `timeline` entries), not orders placed that day — an order placed
 * yesterday but accepted today counts toward today's SLA score, not
 * yesterday's.
 */
export const sellerDailyStatsSchema = z.object({
  id: z.string().min(1),
  sellerId: sellerIdSchema,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date bucket'),
  ordersCount: z.number().int().nonnegative().default(0),
  revenuePaise: z.number().int().nonnegative().default(0),
  unitsSold: z.number().int().nonnegative().default(0),
  topParts: z.array(sellerDailyTopPartSchema).default([]),
  slaAcceptedOnTime: z.number().int().nonnegative().default(0),
  slaAcceptedLate: z.number().int().nonnegative().default(0),
  slaPackedOnTime: z.number().int().nonnegative().default(0),
  slaPackedLate: z.number().int().nonnegative().default(0),
  /** subOrders placed that day (same createdAt bucket as ordersCount) that ended up cancelled or rejected as of rollup time — feeds computeSellerTrustScores.ts's cancellation component (Phase 17). */
  cancelledCount: z.number().int().nonnegative().default(0),
  /** `returns` docs against this seller whose `requestedAt` falls in this day's bucket, regardless of outcome — feeds the trust score's return component. */
  returnsCount: z.number().int().nonnegative().default(0),
  createdAt: epochMsSchema,
  updatedAt: epochMsSchema,
})
export type SellerDailyStats = z.infer<typeof sellerDailyStatsSchema>
export const sellerDailyStatsConverter = makeFirestoreConverter(sellerDailyStatsSchema)

/**
 * One aggregated "buyers searched for this but nothing matched" query,
 * scoped server-side to the calling seller's `categorySlugs` (requirement
 * 6's "missed demand" panel) — `searchMisses` itself has no `sellerId`
 * field and stays admin-read-only in firestore.rules, so this is exposed
 * only through getMissedDemandForSeller.ts's callable, never a direct read.
 */
export const missedDemandItemSchema = z.object({
  normalizedQuery: z.string().min(1),
  sampleQuery: z.string().min(1),
  count: z.number().int().positive(),
  categorySlug: z.string().optional(),
})
export type MissedDemandItem = z.infer<typeof missedDemandItemSchema>

export const getMissedDemandForSellerResultSchema = z.object({
  items: z.array(missedDemandItemSchema),
})
export type GetMissedDemandForSellerResult = z.infer<typeof getMissedDemandForSellerResultSchema>
