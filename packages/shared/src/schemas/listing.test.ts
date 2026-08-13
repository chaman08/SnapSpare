import { describe, expect, it } from 'vitest'
import { listingPricingSchema, MAX_PRICING_TIERS } from './listing'

function tiers(...rows: Array<[number, number | null, number]>) {
  return rows.map(([minQty, maxQty, unitPricePaise]) => ({ minQty, maxQty, unitPricePaise }))
}

describe('listingPricingSchema', () => {
  it('accepts a single open-ended tier at MOQ', () => {
    const result = listingPricingSchema.safeParse({
      moq: 1,
      tiers: tiers([1, null, 1000]),
    })
    expect(result.success).toBe(true)
  })

  it('accepts a valid multi-tier ladder: ascending contiguous qty, strictly descending price', () => {
    const result = listingPricingSchema.safeParse({
      moq: 10,
      tiers: tiers([10, 49, 100], [50, 99, 90], [100, null, 80]),
    })
    expect(result.success).toBe(true)
  })

  it('rejects when the first tier minQty does not equal MOQ', () => {
    const result = listingPricingSchema.safeParse({
      moq: 10,
      tiers: tiers([5, null, 100]),
    })
    expect(result.success).toBe(false)
  })

  it('rejects a gap between tiers', () => {
    const result = listingPricingSchema.safeParse({
      moq: 10,
      tiers: tiers([10, 49, 100], [51, null, 90]), // gap: 50 is uncovered
    })
    expect(result.success).toBe(false)
  })

  it('rejects overlapping tiers', () => {
    const result = listingPricingSchema.safeParse({
      moq: 10,
      tiers: tiers([10, 49, 100], [40, null, 90]), // overlaps 40-49
    })
    expect(result.success).toBe(false)
  })

  it('rejects a non-decreasing unit price (equal)', () => {
    const result = listingPricingSchema.safeParse({
      moq: 10,
      tiers: tiers([10, 49, 100], [50, null, 100]),
    })
    expect(result.success).toBe(false)
  })

  it('rejects a non-decreasing unit price (increase)', () => {
    const result = listingPricingSchema.safeParse({
      moq: 10,
      tiers: tiers([10, 49, 100], [50, null, 110]),
    })
    expect(result.success).toBe(false)
  })

  it('rejects when the last tier is not open-ended', () => {
    const result = listingPricingSchema.safeParse({
      moq: 10,
      tiers: tiers([10, 49, 100], [50, 99, 90]),
    })
    expect(result.success).toBe(false)
  })

  it('rejects when a non-last tier is open-ended', () => {
    const result = listingPricingSchema.safeParse({
      moq: 10,
      tiers: tiers([10, null, 100], [50, null, 90]),
    })
    expect(result.success).toBe(false)
  })

  it(`rejects more than ${MAX_PRICING_TIERS} tiers`, () => {
    const result = listingPricingSchema.safeParse({
      moq: 1,
      tiers: tiers(
        [1, 1, 700],
        [2, 2, 600],
        [3, 3, 500],
        [4, 4, 400],
        [5, 5, 300],
        [6, 6, 200],
        [7, null, 100],
      ),
    })
    expect(result.success).toBe(false)
  })

  it('rejects an empty tier list', () => {
    const result = listingPricingSchema.safeParse({ moq: 1, tiers: [] })
    expect(result.success).toBe(false)
  })
})
