import type { PricingTier } from '../schemas/listing'
import type { Paise } from '../types/money'
import { applyPercent } from '../types/money'
import {
  computeChargeableWeightGrams,
  DEFAULT_LISTING_WEIGHT_GRAMS,
  DEFAULT_SHIPPING_CONFIG,
  estimateSellerShipping,
  type ShippingDimensionsCm,
} from './shipping'

export interface ListingMarginInput {
  costPricePaise: Paise
  tiers: PricingTier[]
  gstRatePercent: number
  taxIncluded: boolean
  /** From getCommissionRatePreview — the seller's effective rate for this listing's category. */
  commissionPercent: number
  weightGrams?: number
  dimensionsCm?: ShippingDimensionsCm
  isOversized?: boolean
}

export interface TierMarginBreakdown {
  minQty: number
  maxQty: number | null
  unitPricePaise: Paise
  /** GST-exclusive per-unit value margin is computed on — GST is a pass-through liability collected on the government's behalf, never a seller cost, so margin excludes it regardless of `taxIncluded`. */
  taxableValuePaise: Paise
  commissionPaise: Paise
  /**
   * Illustrative only — priced against `zone_national` (a representative
   * mid-distance zone, since the buyer's actual state isn't known at
   * listing-authoring time) for a single-unit shipment at this tier's
   * price. The real per-order shipping charge is computed at checkout by
   * priceCart, which knows the real buyer zone and full cart weight/value.
   */
  estimatedShippingPaise: Paise
  /** taxableValuePaise − costPricePaise − commissionPaise − estimatedShippingPaise */
  marginPaise: Paise
  /** Rounded to one decimal place. */
  marginPercent: number
  /** True when marginPaise < 0 — the tier's price doesn't cover cost + commission + estimated shipping, not just the raw cost price. */
  belowCost: boolean
}

/**
 * Per-tier margin breakdown for the SlabPricingEditor's margin calculator —
 * a pure function over already-known inputs (no Firestore/network access),
 * so it works identically live in the browser as the seller edits tiers and
 * in any server-side preview. Reuses `estimateSellerShipping` (the same
 * function checkout pricing uses) rather than reimplementing shipping math.
 */
export function computeListingMargin(input: ListingMarginInput): TierMarginBreakdown[] {
  const chargeableWeightGrams = computeChargeableWeightGrams(
    input.weightGrams ?? DEFAULT_LISTING_WEIGHT_GRAMS,
    input.dimensionsCm,
  )

  return input.tiers.map((tier): TierMarginBreakdown => {
    const taxableValuePaise = input.taxIncluded
      ? Math.round(tier.unitPricePaise / (1 + input.gstRatePercent / 100))
      : tier.unitPricePaise

    const commissionPaise = applyPercent(taxableValuePaise, input.commissionPercent)

    const shippingEstimate = estimateSellerShipping(
      'zone_national',
      chargeableWeightGrams,
      taxableValuePaise,
      DEFAULT_SHIPPING_CONFIG,
      { isOversized: input.isOversized },
    )

    const marginPaise = taxableValuePaise - input.costPricePaise - commissionPaise - shippingEstimate.shippingPaise
    const marginPercent = taxableValuePaise === 0 ? 0 : Math.round((marginPaise / taxableValuePaise) * 1000) / 10

    return {
      minQty: tier.minQty,
      maxQty: tier.maxQty,
      unitPricePaise: tier.unitPricePaise,
      taxableValuePaise,
      commissionPaise,
      estimatedShippingPaise: shippingEstimate.shippingPaise,
      marginPaise,
      marginPercent,
      belowCost: marginPaise < 0,
    }
  })
}
