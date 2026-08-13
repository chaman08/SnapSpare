import { z } from 'zod'
import { buyerTypeSchema } from '../enums'
import { makeFirestoreConverter } from '../firestore/converter'
import { epochMsSchema } from './common'

/**
 * The funnel steps the admin dashboard tracks end-to-end (Phase 22
 * requirement 2). A subset of the full ecommerce event catalog
 * (analytics/events.ts) — only the steps that make sense as one linear
 * funnel with a single drop-off percentage between consecutive steps.
 * `purchase` is deliberately last: its daily count is overwritten by
 * reconcileFunnelPurchases.ts from the authoritative `orders` collection
 * rather than trusted from client beacons (see that file's header comment).
 */
export const funnelStepSchema = z.enum([
  'search',
  'view_item_list',
  'view_item',
  'add_to_cart',
  'view_cart',
  'begin_checkout',
  'add_payment_info',
  'purchase',
])
export type FunnelStep = z.infer<typeof funnelStepSchema>

/** `'all'` sentinel alongside the real buyer types so ungated (pre-auth) traffic still has a home segment. */
export const funnelSegmentSchema = z.union([buyerTypeSchema, z.literal('all')])
export type FunnelSegment = z.infer<typeof funnelSegmentSchema>

/**
 * One counter doc per (date, segment) — incremented server-side by
 * logFunnelEvent.ts so the admin funnel dashboard is a handful of doc reads
 * per date range instead of scanning raw event logs. Doc id:
 * `${date}__${segment}` (date is `YYYY-MM-DD` in Asia/Kolkata).
 */
export const analyticsFunnelDailySchema = z.object({
  id: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  segment: funnelSegmentSchema,
  steps: z.record(funnelStepSchema, z.number().int().nonnegative()).default({}),
  updatedAt: epochMsSchema,
})
export type AnalyticsFunnelDaily = z.infer<typeof analyticsFunnelDailySchema>
export const analyticsFunnelDailyConverter = makeFirestoreConverter(analyticsFunnelDailySchema)

export const logFunnelEventRequestSchema = z.object({
  step: funnelStepSchema,
  /** Client-supplied from the signed-in profile; omitted (guest/unknown) buckets into the 'all' segment only. */
  buyerType: buyerTypeSchema.optional(),
})
export type LogFunnelEventRequest = z.infer<typeof logFunnelEventRequestSchema>

/**
 * GMV-by-tier rollup (Phase 22 requirement 2's "slab-effectiveness report").
 * Bucketed by the raw `tierMinQtyApplied` value actually applied on each
 * subOrder line item — the minimum-quantity breakpoint the buyer crossed —
 * rather than each listing's own ordinal tier position (1st/2nd/3rd slab),
 * since ladders vary per listing and re-deriving ordinal position would need
 * an extra join against every listing at rollup time. Good enough to answer
 * "how much GMV comes from bulk buying vs. single-unit purchases"; a
 * per-listing ordinal-tier breakdown is a further refinement, not built here
 * — see rollupSlabEffectivenessDaily.ts's header comment.
 */
export const slabEffectivenessBucketSchema = z.object({
  tierMinQtyApplied: z.number().int().positive(),
  gmvPaise: z.number().int().nonnegative(),
  unitsSold: z.number().int().nonnegative(),
  lineCount: z.number().int().nonnegative(),
})
export type SlabEffectivenessBucket = z.infer<typeof slabEffectivenessBucketSchema>

export const slabEffectivenessDailySchema = z.object({
  id: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  buckets: z.array(slabEffectivenessBucketSchema).default([]),
  totalGmvPaise: z.number().int().nonnegative(),
  updatedAt: epochMsSchema,
})
export type SlabEffectivenessDaily = z.infer<typeof slabEffectivenessDailySchema>
export const slabEffectivenessDailyConverter = makeFirestoreConverter(slabEffectivenessDailySchema)

/**
 * Monthly cohort-retention matrix per buyer type (Phase 22 requirement 2).
 * `retention["0"]` is always `cohortSize` (every buyer in the cohort placed
 * their first order in `cohortMonth`, by definition); `retention["1"]` is how
 * many of them placed >= 1 order in `cohortMonth + 1 month`, etc. Doc id:
 * `${buyerType}__${cohortMonth}` (cohortMonth is `YYYY-MM`).
 */
export const cohortRetentionSchema = z.object({
  id: z.string().min(1),
  buyerType: buyerTypeSchema,
  cohortMonth: z.string().regex(/^\d{4}-\d{2}$/),
  cohortSize: z.number().int().nonnegative(),
  /** Keyed by month offset as a string ("0", "1", "2", ...) since Firestore/zod records need string keys. */
  retention: z.record(z.string(), z.number().int().nonnegative()).default({}),
  updatedAt: epochMsSchema,
})
export type CohortRetention = z.infer<typeof cohortRetentionSchema>
export const cohortRetentionConverter = makeFirestoreConverter(cohortRetentionSchema)
