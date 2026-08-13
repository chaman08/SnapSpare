import { z } from 'zod'
import { makeFirestoreConverter } from '../firestore/converter'
import { paiseSchema } from '../types/money'
import { epochMsSchema } from './common'

export const commissionRateSchema = z.object({
  percent: z.number().min(0).max(100),
  flatFeePaise: paiseSchema.optional(),
})
export type CommissionRate = z.infer<typeof commissionRateSchema>

export const commissionPromotionScopeSchema = z.enum(['platform', 'category', 'seller'])
export type CommissionPromotionScope = z.infer<typeof commissionPromotionScopeSchema>

/**
 * A time-boxed override — most commonly a promotional zero-commission window
 * for a seller or category, but any percent override works the same way.
 * `startAt`/`endAt` are inclusive; `computeCommission` (pricing/commission.ts)
 * picks the first promotion (in array order) whose scope matches and whose
 * window contains "now", so admins should keep more specific promotions
 * (seller-scoped) earlier in the array than broader ones (platform-scoped).
 */
export const commissionPromotionSchema = z.object({
  scope: commissionPromotionScopeSchema,
  categorySlug: z.string().min(1).optional(),
  sellerId: z.string().min(1).optional(),
  percent: z.number().min(0).max(100),
  startAt: epochMsSchema,
  endAt: epochMsSchema,
})
export type CommissionPromotion = z.infer<typeof commissionPromotionSchema>

/**
 * Singleton document at `config/commission` (same pattern as `config/tax` —
 * see functions/src/tax/taxConfig.ts). Category-wise commission plan plus
 * per-seller overrides (reusing `sellerSchema.commissionRatePercent`) and
 * promotional zero-commission windows — design brief item 4. Applied at
 * delivery, not order placement, by
 * functions/src/payments/applyCommissionOnDelivered.ts.
 */
export const commissionConfigSchema = z.object({
  id: z.string().min(1),
  categoryRates: z.record(z.string(), commissionRateSchema).default({}),
  promotions: z.array(commissionPromotionSchema).default([]),
  /** Days between seller settlement runs — functions/src/payments/runSellerPayouts.ts. */
  settlementCycleDays: z.number().int().positive().default(7),
  /** Days past a credit statement's due date before autoBlockOverdueCredit.ts suspends the account. */
  creditOverdueGraceDays: z.number().int().nonnegative().default(7),
  /** Flat penalty posted to a seller's ledger on an SLA breach (autoCancelUnacceptedSubOrders.ts). Absent means no penalty is posted. */
  slaBreachPenaltyPaise: paiseSchema.optional(),
  updatedAt: epochMsSchema,
})
export type CommissionConfig = z.infer<typeof commissionConfigSchema>

export const commissionConfigConverter = makeFirestoreConverter(commissionConfigSchema)

/**
 * Request/result for the `getCommissionRatePreview` callable — the
 * SlabPricingEditor's margin calculator needs the caller's effective
 * commission rate per category without ever exposing the raw
 * `config/commission` doc (categoryRates/promotions are competitively
 * sensitive — see firestore.rules' Phase 14 lockdown). Plural
 * `categorySlugs` so a bulk price-change preview (Phase 14 bulk ops) can
 * resolve many categories in one round trip.
 */
export const getCommissionRatePreviewRequestSchema = z.object({
  categorySlugs: z.array(z.string().min(1)).min(1).max(50),
})
export type GetCommissionRatePreviewRequest = z.infer<typeof getCommissionRatePreviewRequestSchema>

export const commissionRatePreviewSchema = z.object({
  percent: z.number().min(0).max(100),
  source: z.enum(['promotion', 'seller_override', 'category', 'platform_default']),
})
export type CommissionRatePreview = z.infer<typeof commissionRatePreviewSchema>

export const getCommissionRatePreviewResultSchema = z.object({
  rates: z.record(z.string(), commissionRatePreviewSchema),
})
export type GetCommissionRatePreviewResult = z.infer<typeof getCommissionRatePreviewResultSchema>

/**
 * Finance module's commission-plan editor (design brief item 8). Every
 * field is optional — only provided ones are updated — and `promotions` is
 * deliberately excluded (a time-boxed promotion editor is a bigger UI than
 * this pass covers; promotions stay seed/console-managed for now, see the
 * Finance module's left-out note).
 */
export const updateCommissionConfigRequestSchema = z.object({
  categoryRates: z.record(z.string(), commissionRateSchema).optional(),
  settlementCycleDays: z.number().int().positive().optional(),
  creditOverdueGraceDays: z.number().int().nonnegative().optional(),
  slaBreachPenaltyPaise: paiseSchema.nullable().optional(),
})
export type UpdateCommissionConfigRequest = z.infer<typeof updateCommissionConfigRequestSchema>

export const updateCommissionConfigResultSchema = z.object({ ok: z.literal(true) })
export type UpdateCommissionConfigResult = z.infer<typeof updateCommissionConfigResultSchema>
