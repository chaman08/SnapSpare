import { z } from 'zod'
import { sellerStatusSchema } from '../enums'
import { makeFirestoreConverter } from '../firestore/converter'
import { addressIdSchema, sellerIdSchema, userIdSchema } from '../ids'
import { paiseSchema } from '../types/money'
import { gstinSchema, ifscSchema, panSchema } from '../validators/indian'
import { epochMsSchema } from './common'

export const sellerTrustTierSchema = z.enum(['new', 'trusted', 'top_rated'])
export type SellerTrustTier = z.infer<typeof sellerTrustTierSchema>

/**
 * Every component is a 0-100 sub-score; `score` is their weighted blend. See
 * functions/src/trust/computeSellerTrustScores.ts for the (documented,
 * hard-coded-constant, not admin-configurable in this phase) weighting.
 */
export const sellerTrustScoreBreakdownSchema = z.object({
  ratingComponent: z.number().min(0).max(100),
  slaComponent: z.number().min(0).max(100),
  cancellationComponent: z.number().min(0).max(100),
  returnComponent: z.number().min(0).max(100),
  spuriousComponent: z.number().min(0).max(100),
  tenureComponent: z.number().min(0).max(100),
})
export type SellerTrustScoreBreakdown = z.infer<typeof sellerTrustScoreBreakdownSchema>

export const sellerTrustScoreSchema = z.object({
  score: z.number().min(0).max(100),
  tier: sellerTrustTierSchema,
  breakdown: sellerTrustScoreBreakdownSchema,
  computedAt: epochMsSchema,
})
export type SellerTrustScore = z.infer<typeof sellerTrustScoreSchema>

export const sellerBusinessTypeSchema = z.enum([
  'individual',
  'proprietorship',
  'partnership',
  'pvt_ltd',
  'llp',
  'other',
])
export type SellerBusinessType = z.infer<typeof sellerBusinessTypeSchema>

export const bankAccountSchema = z.object({
  accountHolderName: z.string().min(1),
  accountNumber: z.string().min(4),
  ifsc: ifscSchema,
  bankName: z.string().min(1),
})
export type BankAccount = z.infer<typeof bankAccountSchema>

export const sellerSchema = z.object({
  id: sellerIdSchema,
  ownerUserId: userIdSchema,
  businessName: z.string().min(1),
  legalName: z.string().min(1),
  gstin: gstinSchema,
  pan: panSchema,
  businessType: sellerBusinessTypeSchema,
  /** Short, invoice-safe identifier used as the prefix segment of every GST invoice/credit-note number this seller generates (e.g. "ACME01/FY26-27/000123") — see functions/src/tax/invoiceNumbering.ts. Falls back to a derived code from `id` when unset (existing sellers onboarded before this field existed). Must stay unique per seller; never reused across sellers once invoices have been issued under it. */
  sellerCode: z.string().min(2).max(12).optional(),
  /**
   * GST composition-scheme seller (turnover-capped flat-rate scheme under
   * Sec 10 CGST Act). A composition dealer cannot collect GST from buyers
   * or issue a tax invoice — only a "Bill of Supply" at NIL disclosed tax —
   * and pays their composition tax out of pocket to the government. Feeds
   * both priceCart.ts (zero-rates tax for this seller's lines) and invoice
   * generation (bill-of-supply wording instead of a tax invoice). Tax rates
   * and thresholds are configuration, not constants — see config/tax and
   * README's compliance note.
   */
  gstComposition: z.boolean().default(false),
  status: sellerStatusSchema,
  ratingAvg: z.number().min(0).max(5).default(0),
  ratingCount: z.number().int().nonnegative().default(0),
  ratingBayesian: z.number().min(0).max(5).default(0),
  /** Penalty-ladder state, set only by functions/src/trust/resolveSpuriousReport.ts. "delisting" is the top rung and reuses `status: 'suspended'` above rather than a separate field. */
  spuriousReportsCount: z.number().int().nonnegative().default(0),
  warningsCount: z.number().int().nonnegative().default(0),
  bannedCategorySlugs: z.array(z.string()).default([]),
  payoutHold: z.boolean().default(false),
  payoutHoldReason: z.string().optional(),
  trustScore: sellerTrustScoreSchema.optional(),
  warehouseAddressId: addressIdSchema.optional(),
  bankAccount: bankAccountSchema,
  commissionRatePercent: z.number().min(0).max(100).optional(),
  /** Whether this seller accepts Cash on Delivery at all — checkout's COD option only ever appears when every seller in the cart has this set (plus the platform-wide `config.codEnabled`, the order's COD cap, and the buyer's abuse flag). */
  codAvailable: z.boolean().default(true),
  /** Overrides `config/shipping`'s platform-wide freeShippingThresholdPaise for this seller's shipments only. Absent means the platform default applies. */
  freeShippingThresholdPaise: paiseSchema.optional(),
  categorySlugs: z.array(z.string()).default([]),
  staffCount: z.number().int().nonnegative().optional(),
  onboardedAt: epochMsSchema.optional(),
  createdAt: epochMsSchema,
  updatedAt: epochMsSchema,
})
export type Seller = z.infer<typeof sellerSchema>

export const sellerConverter = makeFirestoreConverter(sellerSchema)
