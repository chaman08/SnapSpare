import type { BuyerType } from '../enums'
import type { Listing, PricingTier } from '../schemas/listing'

/** The tier ladder that applies for `buyerType` — the seller's group override if one exists for that buyer type, else the listing's default ladder. */
export function resolveTiersForBuyer(listing: Listing, buyerType: BuyerType | undefined): PricingTier[] {
  const override = buyerType ? listing.groupPricing?.[buyerType] : undefined
  return override ?? listing.pricing.tiers
}

/** The tier that applies at `qty` from a resolved ladder — falls back to the last (open-ended) tier, since a valid ladder is guaranteed contiguous from moq upward. */
export function tierForQty(tiers: PricingTier[], qty: number): PricingTier {
  const match = tiers.find((tier) => qty >= tier.minQty && (tier.maxQty === null || qty <= tier.maxQty))
  return match ?? (tiers[tiers.length - 1] as PricingTier)
}

/** The next-cheaper tier above the one `qty` currently sits in, if any — drives the "add N more to unlock ₹X/unit" nudge. */
export function nextTier(tiers: PricingTier[], qty: number): PricingTier | undefined {
  const currentIndex = tiers.findIndex((tier) => qty >= tier.minQty && (tier.maxQty === null || qty <= tier.maxQty))
  if (currentIndex === -1) return undefined
  return tiers[currentIndex + 1]
}

/** Convenience wrapper: resolves the buyer's ladder and the tier that applies at `qty` in one call — what priceCart and the optimistic client UI should both call so they can never disagree. */
export function resolveActiveTier(listing: Listing, buyerType: BuyerType | undefined, qty: number): PricingTier {
  return tierForQty(resolveTiersForBuyer(listing, buyerType), qty)
}
