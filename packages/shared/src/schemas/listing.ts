import { z } from 'zod'
import { buyerTypeSchema, listingStatusSchema, partConditionSchema } from '../enums'
import { makeFirestoreConverter } from '../firestore/converter'
import { brandAuthorizationIdSchema, listingIdSchema, partIdSchema, sellerIdSchema } from '../ids'
import { paiseSchema } from '../types/money'
import { hsnSchema } from '../validators/indian'
import { callableRequestSchema, epochMsSchema } from './common'
import { gstRatePercentSchema } from './catalogPart'
import { dimensionsCmSchema } from './shipping'

/** Never awarded without a verified brandAuthorization doc — see functions/src/listings/persistListing.ts and functions/src/trust/onBrandAuthorizationWrite.ts. `verifiedAt` is the authorization document's own verification date, shown alongside the badge per the product brief. */
export const listingGenuineBadgeSchema = z.object({
  verified: z.boolean(),
  verifiedAt: epochMsSchema.optional(),
  brandAuthorizationId: brandAuthorizationIdSchema.optional(),
})
export type ListingGenuineBadge = z.infer<typeof listingGenuineBadgeSchema>

export const MAX_PRICING_TIERS = 6

/**
 * One quantity-slab pricing tier. `maxQty: null` marks the open-ended top
 * tier — exactly one tier (the last) is allowed to be open-ended, enforced
 * by listingPricingSchema's superRefine below.
 */
export const pricingTierSchema = z.object({
  minQty: z.number().int().positive(),
  maxQty: z.number().int().positive().nullable(),
  unitPricePaise: z.number().int().nonnegative(),
})
export type PricingTier = z.infer<typeof pricingTierSchema>

/**
 * The full quantity-slab pricing ladder for a listing. This is the core
 * differentiator of the product, so its shape is validated exhaustively:
 * ascending + contiguous quantity ranges, strictly descending unit prices
 * (bulk must be cheaper, never equal or more expensive), at most
 * MAX_PRICING_TIERS tiers, only the last tier open-ended, and the first
 * tier's minQty must equal the listing's MOQ (you can't buy below MOQ, so
 * there's no cheaper "tier zero" below it).
 */
export const listingPricingSchema = z
  .object({
    moq: z.number().int().positive(),
    /**
     * Quantity increment a buyer must order in beyond `moq` (e.g. 10 when a
     * part is sold "by the box" of 10 pcs). Defaults to 1 (order any whole
     * unit above MOQ) so existing listings without this field still parse.
     * QuantityStepper enforces this client-side; see its `packLabel` sibling
     * field below for the human-readable pack description.
     */
    stepQty: z.number().int().positive().default(1),
    tiers: z.array(pricingTierSchema).min(1).max(MAX_PRICING_TIERS),
  })
  .superRefine((value, ctx) => {
    const { moq, tiers, stepQty } = value

    const firstTier = tiers[0]
    if (firstTier && firstTier.minQty !== moq) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['tiers', 0, 'minQty'],
        message: `First tier minQty (${firstTier.minQty}) must equal the listing MOQ (${moq})`,
      })
    }

    if (moq % stepQty !== 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['moq'],
        message: `MOQ (${moq}) must be a whole multiple of stepQty (${stepQty})`,
      })
    }

    tiers.forEach((tier, index) => {
      const isLast = index === tiers.length - 1

      if (isLast && tier.maxQty !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['tiers', index, 'maxQty'],
          message: 'The last tier must be open-ended (maxQty: null)',
        })
      }

      if (!isLast && tier.maxQty === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['tiers', index, 'maxQty'],
          message: 'Only the last tier may be open-ended',
        })
      }

      if (!isLast && tier.maxQty !== null && tier.maxQty < tier.minQty) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['tiers', index, 'maxQty'],
          message: 'maxQty must be greater than or equal to minQty',
        })
      }

      if (index > 0) {
        const previous = tiers[index - 1] as PricingTier
        const expectedMinQty = previous.maxQty === null ? null : previous.maxQty + 1

        if (expectedMinQty === null || tier.minQty !== expectedMinQty) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['tiers', index, 'minQty'],
            message: `Tier ranges must be contiguous: expected minQty ${expectedMinQty ?? '<previous tier is open-ended>'}, got ${tier.minQty}`,
          })
        }

        if (tier.unitPricePaise >= previous.unitPricePaise) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['tiers', index, 'unitPricePaise'],
            message: 'Unit price must strictly decrease from one tier to the next',
          })
        }
      }
    })
  })
export type ListingPricing = z.infer<typeof listingPricingSchema>

/**
 * Optional seller-negotiated pricing ladder for a specific buyer group,
 * overriding `pricing.tiers` for buyers of that `buyerType` only (checked
 * before falling back to the default ladder — see
 * `packages/shared/src/pricing/tiers.ts`'s `resolveTiersForBuyer`). Shares
 * `pricing.moq`/`pricing.stepQty` — only the price-per-tier differs, so
 * quantity boundaries below MOQ never change per group. Shape-validated
 * only (ascending/contiguous/strictly-descending isn't re-enforced here);
 * no seller-facing UI to author these exists yet, so malformed data can
 * only arrive via direct admin/seed writes.
 */
export const groupPricingSchema = z.record(buyerTypeSchema, z.array(pricingTierSchema).min(1).max(MAX_PRICING_TIERS))
export type GroupPricing = z.infer<typeof groupPricingSchema>

export const listingSchema = z.object({
  id: listingIdSchema,
  sellerId: sellerIdSchema,
  partId: partIdSchema,
  sku: z.string().min(1),
  title: z.string().min(1),
  condition: partConditionSchema,
  stockQty: z.number().int().nonnegative(),
  /** Units held against pending_payment orders (never against confirmed/committed sales — those decrement stockQty directly). Available-to-sell is always `stockQty - reservedStock`; see createOrder/confirmPayment/releaseExpiredReservations for the reserve → commit/release lifecycle. */
  reservedStock: z.number().int().nonnegative().default(0),
  /** Below this, checkLowStockAndNotify.ts flags the listing for the seller — purely an alert threshold, never enforced against sale/reservation. Absent means the platform default applies (see that function). Fine to leave public: never surfaced to buyers, not competitively sensitive. */
  lowStockThresholdQty: z.number().int().nonnegative().optional(),
  maxOrderQty: z.number().int().positive().optional(),
  pricing: listingPricingSchema,
  groupPricing: groupPricingSchema.optional(),
  mrpPaise: z.number().int().nonnegative().optional(),
  taxIncluded: z.boolean(),
  hsnCode: hsnSchema,
  gstRatePercent: gstRatePercentSchema,
  /** Shipping weight per unit, used by priceCart's shipping estimate. Absent listings fall back to a flat default (see pricing/shipping.ts). */
  weightGrams: z.number().int().positive().optional(),
  /** Per-unit package dimensions, used to compute volumetric (dimensional) weight — see pricing/shipping.ts's computeChargeableWeightGrams. Absent means priceCart charges actual weightGrams only. */
  dimensionsCm: dimensionsCmSchema.optional(),
  /** Bumpers, panels, batteries — routes this listing's shipment to surface transport (extended ETA) and, per config/shipping's oversizedCodRestricted, may block Cash on Delivery for any order containing it. */
  isOversized: z.boolean().default(false),
  images: z.array(z.string().url()).default([]),
  warrantyMonths: z.number().int().nonnegative().optional(),
  /** Human-readable pack description shown next to the stepper, e.g. "1 box = 10 pcs". Purely cosmetic — stepQty is what's actually enforced. */
  packLabel: z.string().optional(),
  /** Days a buyer has to request a return after delivery, if this seller/listing offers one. Absent means no return window is advertised. */
  returnWindowDays: z.number().int().nonnegative().optional(),
  status: listingStatusSchema,
  /** Set by setHolidayMode.ts when it auto-pauses this listing for the seller's holiday mode; lets resuming holiday mode reactivate only listings it paused, never ones the seller paused manually. Absent/false otherwise. */
  pausedByHolidayMode: z.boolean().optional(),
  isFeatured: z.boolean().default(false),
  viewCount: z.number().int().nonnegative().default(0),
  /** Recomputed by functions/src/reviews/onReviewWrite.ts whenever a published review count changes for this listing — see packages/shared/src/trust/bayesian.ts for how ratingBayesian is derived from ratingAvg/ratingCount. */
  ratingAvg: z.number().min(0).max(5).default(0),
  ratingCount: z.number().int().nonnegative().default(0),
  ratingBayesian: z.number().min(0).max(5).default(0),
  /** Fitment-quality feedback signal from reviews' fitmentAccurate field — surfaced to admins, never auto-mutates the verified catalogFitments rows themselves. */
  fitmentAccurateCount: z.number().int().nonnegative().default(0),
  fitmentInaccurateCount: z.number().int().nonnegative().default(0),
  genuineBadge: listingGenuineBadgeSchema.optional(),
  createdAt: epochMsSchema,
  updatedAt: epochMsSchema,
})
export type Listing = z.infer<typeof listingSchema>

export const listingConverter = makeFirestoreConverter(listingSchema)

/**
 * The seller-authorable subset of `listingSchema` — everything a seller can
 * set when creating/editing a listing through the `saveListing` callable.
 * Excludes fields the server owns: `id` (server-generated on create),
 * `sellerId` (from the caller's auth claim, never client-supplied),
 * `reservedStock`/`viewCount` (mutated only by order/analytics flows),
 * `status`/`pausedByHolidayMode` (state-machine fields — see
 * `updateListingStatusRequestSchema` below), and timestamps. `id` is
 * optional: absent means create, present means update (and must belong to
 * the caller's own seller — enforced by `persistListing.ts`, not this
 * schema).
 */
export const saveListingRequestSchema = callableRequestSchema(
  listingSchema.omit({
    id: true,
    sellerId: true,
    reservedStock: true,
    viewCount: true,
    status: true,
    pausedByHolidayMode: true,
    ratingAvg: true,
    ratingCount: true,
    ratingBayesian: true,
    fitmentAccurateCount: true,
    fitmentInaccurateCount: true,
    genuineBadge: true,
    createdAt: true,
    updatedAt: true,
  }).extend({
    id: listingIdSchema.optional(),
  }),
)
export type SaveListingRequest = z.infer<typeof saveListingRequestSchema>

export const saveListingResultSchema = z.object({
  id: listingIdSchema,
})
export type SaveListingResult = z.infer<typeof saveListingResultSchema>

/**
 * Seller-initiated status transitions only — `out_of_stock` is system-set
 * (see `onListingStockAutoStatus.ts`) and `rejected` is admin-only, so
 * neither is a valid target here.
 */
export const listingStatusTransitionSchema = z.enum(['draft', 'active', 'paused', 'archived'])
export type ListingStatusTransition = z.infer<typeof listingStatusTransitionSchema>

export const updateListingStatusRequestSchema = z.object({
  id: listingIdSchema,
  status: listingStatusTransitionSchema,
})
export type UpdateListingStatusRequest = z.infer<typeof updateListingStatusRequestSchema>

export const updateListingStatusResultSchema = z.object({
  status: listingStatusSchema,
})
export type UpdateListingStatusResult = z.infer<typeof updateListingStatusResultSchema>

/**
 * `listings/{id}/private/cost` — a seller's per-listing cost price, kept off
 * the parent `listings` doc entirely because that doc is publicly readable
 * for active listings (see firestore.rules) and cost price is competitively
 * sensitive. Read/written only by the caller who owns the listing (or an
 * admin), via `getListingCostPrice`/`setListingCostPrice` — see
 * `packages/shared/src/pricing/margin.ts` for what it feeds.
 */
export const costPrivateSchema = z.object({
  costPricePaise: paiseSchema,
  updatedAt: epochMsSchema,
})
export type CostPrivate = z.infer<typeof costPrivateSchema>

export const setListingCostPriceRequestSchema = z.object({
  id: listingIdSchema,
  costPricePaise: paiseSchema,
})
export type SetListingCostPriceRequest = z.infer<typeof setListingCostPriceRequestSchema>

export const getListingCostPriceRequestSchema = z.object({
  id: listingIdSchema,
})
export type GetListingCostPriceRequest = z.infer<typeof getListingCostPriceRequestSchema>

export const getListingCostPriceResultSchema = z.object({
  costPricePaise: paiseSchema.optional(),
})
export type GetListingCostPriceResult = z.infer<typeof getListingCostPriceResultSchema>

/** Listings module (design brief item 5) admin moderation — block sets `rejected` (reason required), unblock restores `active`. Unlike the seller-facing updateListingStatusRequestSchema, admin may target `rejected` and doesn't go through the seller-permission gate. */
export const adminSetListingStatusRequestSchema = z.object({
  id: listingIdSchema,
  status: z.enum(['active', 'rejected']),
  reason: z.string().min(1).optional(),
})
export type AdminSetListingStatusRequest = z.infer<typeof adminSetListingStatusRequestSchema>

export const adminSetListingStatusResultSchema = z.object({ status: listingStatusSchema })
export type AdminSetListingStatusResult = z.infer<typeof adminSetListingStatusResultSchema>
