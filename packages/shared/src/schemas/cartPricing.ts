import { z } from 'zod'
import { buyerTypeSchema } from '../enums'
import { SHIPPING_ZONES } from '../pricing/shipping'
import { listingIdSchema, partIdSchema, sellerIdSchema } from '../ids'
import { paiseSchema } from '../types/money'
import { hsnSchema, pincodeSchema } from '../validators/indian'
import { epochMsSchema } from './common'
import { gstRatePercentSchema } from './catalogPart'

// ---------------------------------------------------------------------------
// Request
// ---------------------------------------------------------------------------

export const priceCartRequestItemSchema = z.object({
  listingId: listingIdSchema,
  qty: z.number().int().positive(),
  /**
   * The cart's add-time price snapshot, sent along purely so the server can
   * detect drift and surface a `price_changed`/`tier_upgraded`/
   * `tier_downgraded` warning — never used to compute any total, which is
   * always derived fresh from the live listing.
   */
  snapshotUnitPricePaise: paiseSchema.optional(),
  snapshotTierMinQtyApplied: z.number().int().positive().optional(),
})
export type PriceCartRequestItem = z.infer<typeof priceCartRequestItemSchema>

/**
 * priceCart is the only source of truth for money in the cart — the client
 * sends nothing but the listing ids + quantities it wants priced (plus the
 * optional coupon/pincode/buyerType context that changes the answer). Every
 * price/tax/discount/shipping figure comes back from the server; nothing in
 * this request carries a price.
 */
export const priceCartRequestSchema = z.object({
  items: z.array(priceCartRequestItemSchema).min(1),
  couponCode: z.string().optional(),
  /** Shipping destination pincode. Optional — omitted for buyers with no saved address yet; see `notices` on the result for what's estimated instead. */
  pincode: pincodeSchema.optional(),
  buyerType: buyerTypeSchema.optional(),
})
export type PriceCartRequest = z.infer<typeof priceCartRequestSchema>

// ---------------------------------------------------------------------------
// Per-line warnings, nudges
// ---------------------------------------------------------------------------

export const cartLineWarningCodeSchema = z.enum([
  'listing_unavailable',
  'out_of_stock',
  'price_changed',
  'qty_adjusted_to_moq',
  'qty_adjusted_to_step',
  'qty_capped_to_stock',
  'tier_upgraded',
  'tier_downgraded',
])
export type CartLineWarningCode = z.infer<typeof cartLineWarningCodeSchema>

/** Structured, not a message string — every user-facing string goes through i18next, so the client maps `code` (+ these params) to a localized line. */
export const cartLineWarningSchema = z.object({
  code: cartLineWarningCodeSchema,
  requestedQty: z.number().int().positive().optional(),
  adjustedQty: z.number().int().positive().optional(),
  previousUnitPricePaise: paiseSchema.optional(),
  newUnitPricePaise: paiseSchema.optional(),
})
export type CartLineWarning = z.infer<typeof cartLineWarningSchema>

export const tierNudgeSchema = z.object({
  qtyToNextTier: z.number().int().positive(),
  nextTierMinQty: z.number().int().positive(),
  nextTierUnitPricePaise: paiseSchema,
  estimatedSavingsPaise: paiseSchema,
})
export type TierNudge = z.infer<typeof tierNudgeSchema>

/** Honest cross-seller nudge (design spec item 5): another active listing for the same part is strictly cheaper at this quantity. */
export const cheaperElsewhereSchema = z.object({
  listingId: listingIdSchema,
  sellerId: sellerIdSchema,
  sellerName: z.string(),
  unitPricePaise: paiseSchema,
})
export type CheaperElsewhere = z.infer<typeof cheaperElsewhereSchema>

// ---------------------------------------------------------------------------
// Priced line / seller group
// ---------------------------------------------------------------------------

export const pricedCartLineSchema = z.object({
  listingId: listingIdSchema,
  partId: partIdSchema,
  sellerId: sellerIdSchema,
  sku: z.string(),
  title: z.string(),
  imageUrl: z.string().optional(),
  /** The server-resolved quantity actually priced — may differ from what the client requested (see `warnings`). 0 means out of stock; the line stays in its seller group (with zero cost) rather than disappearing, so the buyer can still see/remove/save it. */
  qty: z.number().int().nonnegative(),
  unitPricePaise: paiseSchema,
  tierMinQtyApplied: z.number().int().positive(),
  hsnCode: hsnSchema,
  gstRatePercent: gstRatePercentSchema,
  lineSubtotalPaise: paiseSchema,
  lineDiscountPaise: paiseSchema,
  lineTaxPaise: paiseSchema,
  lineTotalPaise: paiseSchema,
  tierNudge: tierNudgeSchema.optional(),
  cheaperElsewhere: cheaperElsewhereSchema.optional(),
  warnings: z.array(cartLineWarningSchema).default([]),
})
export type PricedCartLine = z.infer<typeof pricedCartLineSchema>

export const shippingZoneSchema = z.enum(SHIPPING_ZONES)

export const pricedSellerGroupSchema = z.object({
  sellerId: sellerIdSchema,
  sellerName: z.string(),
  sellerRatingAvg: z.number().min(0).max(5),
  sellerRatingCount: z.number().int().nonnegative(),
  items: z.array(pricedCartLineSchema).min(1),
  subtotalPaise: paiseSchema,
  discountPaise: paiseSchema,
  taxableValuePaise: paiseSchema,
  isInterState: z.boolean(),
  cgstPaise: paiseSchema,
  sgstPaise: paiseSchema,
  igstPaise: paiseSchema,
  taxPaise: paiseSchema,
  shippingZone: shippingZoneSchema.optional(),
  shippingPaise: paiseSchema,
  freeShippingRemainingPaise: paiseSchema,
  etaDaysMin: z.number().int().positive().optional(),
  etaDaysMax: z.number().int().positive().optional(),
  /** True when any line in this seller's shipment is an oversized listing routed to surface transport — see pricing/shipping.ts's estimateSellerShipping. Already reflected in etaDaysMin/Max above; surfaced separately so the UI can show a dedicated notice. */
  viaSurfaceTransport: z.boolean().default(false),
  /** True when an oversized listing in this seller's shipment blocks Cash on Delivery (config/shipping.oversizedCodRestricted) — checked by createOrder.ts before accepting a COD order. */
  codRestricted: z.boolean().default(false),
  totalPaise: paiseSchema,
})
export type PricedSellerGroup = z.infer<typeof pricedSellerGroupSchema>

// ---------------------------------------------------------------------------
// Coupon outcome
// ---------------------------------------------------------------------------

export const couponRejectionReasonSchema = z.enum([
  'not_found',
  'inactive',
  'expired',
  'not_yet_valid',
  'min_order_not_met',
  'not_applicable_to_cart',
  'usage_limit_reached',
])
export type CouponRejectionReason = z.infer<typeof couponRejectionReasonSchema>

export const couponApplicationResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('applied'),
    code: z.string(),
    discountPaise: paiseSchema,
  }),
  z.object({
    status: z.literal('rejected'),
    code: z.string(),
    reason: couponRejectionReasonSchema,
    minOrderValuePaise: paiseSchema.optional(),
  }),
])
export type CouponApplicationResult = z.infer<typeof couponApplicationResultSchema>

// ---------------------------------------------------------------------------
// Cart-level notices (not tied to one line, e.g. missing shipping address)
// ---------------------------------------------------------------------------

export const cartNoticeCodeSchema = z.enum(['no_shipping_address'])
export const cartNoticeSchema = z.object({ code: cartNoticeCodeSchema })
export type CartNotice = z.infer<typeof cartNoticeSchema>

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------

export const priceCartResultSchema = z.object({
  sellerGroups: z.array(pricedSellerGroupSchema),
  /** Listing ids that no longer exist or are no longer active — can't be grouped under a seller at all, so they're reported separately rather than dropped silently. */
  unavailableListingIds: z.array(listingIdSchema).default([]),
  subtotalPaise: paiseSchema,
  discountPaise: paiseSchema,
  shippingPaise: paiseSchema,
  taxableValuePaise: paiseSchema,
  cgstPaise: paiseSchema,
  sgstPaise: paiseSchema,
  igstPaise: paiseSchema,
  taxPaise: paiseSchema,
  totalPaise: paiseSchema,
  coupon: couponApplicationResultSchema.optional(),
  freeShippingThresholdPaise: paiseSchema,
  notices: z.array(cartNoticeSchema).default([]),
  pricedAt: epochMsSchema,
})
export type PriceCartResult = z.infer<typeof priceCartResultSchema>
