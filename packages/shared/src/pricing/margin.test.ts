import { describe, expect, it } from 'vitest'
import { computeListingMargin } from './margin'

describe('computeListingMargin', () => {
  it('computes margin excluding GST for a tax-included price', () => {
    // unitPricePaise 11800 at 18% GST -> taxable value 10000
    const [tier] = computeListingMargin({
      costPricePaise: 5000,
      tiers: [{ minQty: 1, maxQty: null, unitPricePaise: 11800 }],
      gstRatePercent: 18,
      taxIncluded: true,
      commissionPercent: 0,
      weightGrams: 500,
    })
    expect(tier?.taxableValuePaise).toBe(10000)
  })

  it('treats an ex-GST price as already taxable (no further stripping)', () => {
    const [tier] = computeListingMargin({
      costPricePaise: 5000,
      tiers: [{ minQty: 1, maxQty: null, unitPricePaise: 10000 }],
      gstRatePercent: 18,
      taxIncluded: false,
      commissionPercent: 0,
      weightGrams: 500,
    })
    expect(tier?.taxableValuePaise).toBe(10000)
  })

  it('deducts commission from the taxable value, not the gross price', () => {
    const [tier] = computeListingMargin({
      costPricePaise: 0,
      tiers: [{ minQty: 1, maxQty: null, unitPricePaise: 11800 }],
      gstRatePercent: 18,
      taxIncluded: true,
      commissionPercent: 10,
      weightGrams: 500,
    })
    // taxable 10000, 10% commission -> 1000
    expect(tier?.commissionPaise).toBe(1000)
  })

  it('flags a tier as belowCost when margin goes negative after cost+commission+shipping', () => {
    const [tier] = computeListingMargin({
      costPricePaise: 9500,
      tiers: [{ minQty: 1, maxQty: null, unitPricePaise: 10000 }],
      gstRatePercent: 0,
      taxIncluded: false,
      commissionPercent: 10,
      weightGrams: 500,
    })
    // taxable 10000, cost 9500, commission 1000, shipping > 0 -> margin well below 0
    expect(tier?.belowCost).toBe(true)
    expect(tier?.marginPaise).toBeLessThan(0)
  })

  it('does not flag a healthy tier as belowCost', () => {
    // A low unit price against the flat zone_national base fare (₹80) would
    // itself look unprofitable, which is realistic (that's exactly why
    // priceCart's free-shipping threshold exists for full-cart orders) —
    // this fixture uses a high-enough unit price that the flat estimated
    // shipping fare doesn't dominate it.
    const [tier] = computeListingMargin({
      costPricePaise: 30000,
      tiers: [{ minQty: 1, maxQty: null, unitPricePaise: 100000 }],
      gstRatePercent: 0,
      taxIncluded: false,
      commissionPercent: 5,
      weightGrams: 300,
    })
    expect(tier?.belowCost).toBe(false)
    expect(tier?.marginPaise).toBeGreaterThan(0)
  })

  it('returns one breakdown per tier, preserving minQty/maxQty', () => {
    const result = computeListingMargin({
      costPricePaise: 1000,
      tiers: [
        { minQty: 1, maxQty: 9, unitPricePaise: 5000 },
        { minQty: 10, maxQty: null, unitPricePaise: 4000 },
      ],
      gstRatePercent: 0,
      taxIncluded: false,
      commissionPercent: 5,
      weightGrams: 500,
    })
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ minQty: 1, maxQty: 9 })
    expect(result[1]).toMatchObject({ minQty: 10, maxQty: null })
  })
})
