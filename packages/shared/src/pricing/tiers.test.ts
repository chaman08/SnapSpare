import { describe, expect, it } from 'vitest'
import type { Listing, PricingTier } from '../schemas/listing'
import { nextTier, resolveActiveTier, resolveTiersForBuyer, tierForQty } from './tiers'

// A 3-tier ladder: 1-9 @ ₹100, 10-49 @ ₹90, 50+ (open-ended) @ ₹80.
const TIERS: PricingTier[] = [
  { minQty: 1, maxQty: 9, unitPricePaise: 100_00 },
  { minQty: 10, maxQty: 49, unitPricePaise: 90_00 },
  { minQty: 50, maxQty: null, unitPricePaise: 80_00 },
]

function listingWith(overrides: Partial<Pick<Listing, 'groupPricing'>> & { tiers?: PricingTier[] } = {}): Listing {
  const { tiers = TIERS, ...rest } = overrides
  return {
    pricing: { moq: 1, stepQty: 1, tiers },
    ...rest,
  } as Listing
}

describe('tierForQty', () => {
  it('resolves the exact first tier at its minQty boundary', () => {
    expect(tierForQty(TIERS, 1)).toEqual(TIERS[0])
  })

  it('resolves the first tier at its maxQty boundary', () => {
    expect(tierForQty(TIERS, 9)).toEqual(TIERS[0])
  })

  it('resolves the second tier at its minQty boundary, one past the first tier', () => {
    expect(tierForQty(TIERS, 10)).toEqual(TIERS[1])
  })

  it('resolves the second tier at its maxQty boundary', () => {
    expect(tierForQty(TIERS, 49)).toEqual(TIERS[1])
  })

  it('resolves the open-ended last tier at its minQty boundary', () => {
    expect(tierForQty(TIERS, 50)).toEqual(TIERS[2])
  })

  it('resolves the open-ended last tier arbitrarily far above its minQty', () => {
    expect(tierForQty(TIERS, 1_000_000)).toEqual(TIERS[2])
  })

  it('falls back to the last (open-ended) tier for a qty below every tier (defensive — a valid ladder always starts at moq, so this should not normally happen)', () => {
    expect(tierForQty(TIERS, 0)).toEqual(TIERS[2])
  })

  it('resolves a single-tier ladder for any qty at or above its minQty', () => {
    const singleTier: PricingTier[] = [{ minQty: 5, maxQty: null, unitPricePaise: 50_00 }]
    expect(tierForQty(singleTier, 5)).toEqual(singleTier[0])
    expect(tierForQty(singleTier, 500)).toEqual(singleTier[0])
  })
})

describe('nextTier', () => {
  it('returns the second tier when qty sits in the first tier', () => {
    expect(nextTier(TIERS, 1)).toEqual(TIERS[1])
    expect(nextTier(TIERS, 9)).toEqual(TIERS[1])
  })

  it('returns the third tier when qty sits in the second tier', () => {
    expect(nextTier(TIERS, 10)).toEqual(TIERS[2])
    expect(nextTier(TIERS, 49)).toEqual(TIERS[2])
  })

  it('returns undefined when qty already sits in the last (open-ended) tier', () => {
    expect(nextTier(TIERS, 50)).toBeUndefined()
    expect(nextTier(TIERS, 1_000_000)).toBeUndefined()
  })

  it('returns undefined for a qty below every tier (no current tier to advance from)', () => {
    expect(nextTier(TIERS, 0)).toBeUndefined()
  })

  it('returns undefined for a single-tier ladder — there is never a next tier to unlock', () => {
    const singleTier: PricingTier[] = [{ minQty: 1, maxQty: null, unitPricePaise: 50_00 }]
    expect(nextTier(singleTier, 1)).toBeUndefined()
  })
})

describe('resolveTiersForBuyer', () => {
  it('returns the listing default ladder when buyerType is undefined', () => {
    expect(resolveTiersForBuyer(listingWith(), undefined)).toEqual(TIERS)
  })

  it('returns the listing default ladder when no group-pricing override exists for the buyer type', () => {
    expect(resolveTiersForBuyer(listingWith(), 'retail')).toEqual(TIERS)
  })

  it("returns the seller's group-pricing override ladder when one exists for the buyer type", () => {
    const garageTiers: PricingTier[] = [{ minQty: 1, maxQty: null, unitPricePaise: 70_00 }]
    const listing = listingWith({ groupPricing: { garage: garageTiers } })
    expect(resolveTiersForBuyer(listing, 'garage')).toEqual(garageTiers)
  })

  it("falls back to the default ladder for a buyer type with no override, even if other buyer types have one", () => {
    const garageTiers: PricingTier[] = [{ minQty: 1, maxQty: null, unitPricePaise: 70_00 }]
    const listing = listingWith({ groupPricing: { garage: garageTiers } })
    expect(resolveTiersForBuyer(listing, 'retail')).toEqual(TIERS)
  })
})

describe('resolveActiveTier', () => {
  it('resolves the buyer-appropriate tier for a given qty in one call', () => {
    const listing = listingWith()
    expect(resolveActiveTier(listing, undefined, 1)).toEqual(TIERS[0])
    expect(resolveActiveTier(listing, undefined, 10)).toEqual(TIERS[1])
    expect(resolveActiveTier(listing, undefined, 50)).toEqual(TIERS[2])
  })

  it('uses the group-pricing override ladder when the buyer type has one', () => {
    const garageTiers: PricingTier[] = [
      { minQty: 1, maxQty: 4, unitPricePaise: 60_00 },
      { minQty: 5, maxQty: null, unitPricePaise: 55_00 },
    ]
    const listing = listingWith({ groupPricing: { garage: garageTiers } })
    expect(resolveActiveTier(listing, 'garage', 1)).toEqual(garageTiers[0])
    expect(resolveActiveTier(listing, 'garage', 5)).toEqual(garageTiers[1])
  })
})
