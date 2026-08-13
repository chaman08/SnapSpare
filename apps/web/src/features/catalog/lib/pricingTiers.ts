import type { ListingPricing, PricingTier } from '@snapspare/shared'

/** The tier that applies at `qty` — falls back to the last (open-ended) tier, since tiers are guaranteed contiguous from moq upward. */
export function tierForQty(pricing: ListingPricing, qty: number): PricingTier {
  const match = pricing.tiers.find(
    (tier) => qty >= tier.minQty && (tier.maxQty === null || qty <= tier.maxQty),
  )
  return match ?? (pricing.tiers[pricing.tiers.length - 1] as PricingTier)
}

/** The next-cheaper tier above the one `qty` currently sits in, if any — drives the "add N more to unlock ₹X/unit" hint. */
export function nextTier(pricing: ListingPricing, qty: number): PricingTier | undefined {
  const currentIndex = pricing.tiers.findIndex(
    (tier) => qty >= tier.minQty && (tier.maxQty === null || qty <= tier.maxQty),
  )
  if (currentIndex === -1) return undefined
  return pricing.tiers[currentIndex + 1]
}
