import { z } from 'zod'
import { returnReasonSchema } from '../enums'
import { makeFirestoreConverter } from '../firestore/converter'
import { epochMsSchema } from './common'

/**
 * Singleton document at config/returns — the policy engine for Phase 18's
 * post-sale flows. Follows commissionConfig.ts's safe-default pattern
 * (functions/src/payments/commissionConfig.ts): money-adjacent but not
 * payment-blocking, so a missing doc falls back to DEFAULT_RETURNS_CONFIG
 * rather than throwing (unlike config/app, which is payment-critical).
 */
export const returnsConfigSchema = z.object({
  id: z.string().min(1),
  /** Per-subcategory return-window override (days after delivery), keyed by CATEGORY_TREE subcategory slug. Falls back to the listing's own returnWindowDays, then config/app.defaultReturnWindowDays. */
  categoryReturnWindowDaysOverride: z.record(z.string(), z.number().int().nonnegative()).default({}),
  /** Subcategory slugs (from constants/categories.ts's CATEGORY_TREE) that can never be returned once fitted — requestReturn.ts hard-rejects these, and the product page must state this before purchase, not just in the returns tab. */
  nonReturnableSubcategorySlugs: z.array(z.string()).default(['sensors', 'ecus']),
  /** Reasons that put return shipping cost on the buyer (deducted from the refund) — every other reason is seller-fault (free return). */
  buyerFaultReasons: z.array(returnReasonSchema).default(['changed_mind']),
  buyerFaultShippingFeePaise: z.number().int().nonnegative().default(9900),
  /** Days after a reverse pickup is booked before autoPassReturnQc.ts auto-passes QC if the seller never acted. */
  qcAutoPassDays: z.number().int().positive().default(5),
  /** Hours an admin has to resolve a dispute before sendDisputeSlaBreachWarnings.ts fires a warning. */
  disputeSlaHours: z.number().int().positive().default(48),
  returnRateAbuseThresholdPercent: z.number().int().positive().default(30),
  returnRateAbuseWindowDays: z.number().int().positive().default(90),
  returnRateAbuseMinOrders: z.number().int().positive().default(5),
  /** RTO count at or above which processRtoRefund.ts sets the buyer's existing codAbuseFlag automatically. */
  rtoAutoCodBlockThreshold: z.number().int().positive().default(3),
  fairUsePolicy: z.object({ en: z.string(), hi: z.string() }).default({
    en: 'Frequent returns or refused Cash on Delivery orders may lead to Cash on Delivery being disabled or return requests requiring manual review on your account.',
    hi: 'बार-बार रिटर्न या कैश ऑन डिलीवरी ऑर्डर अस्वीकार करने पर आपके खाते पर कैश ऑन डिलीवरी बंद की जा सकती है या रिटर्न अनुरोधों की मैन्युअल समीक्षा आवश्यक हो सकती है।',
  }),
  updatedAt: epochMsSchema,
})
export type ReturnsConfig = z.infer<typeof returnsConfigSchema>

export const returnsConfigConverter = makeFirestoreConverter(returnsConfigSchema)
