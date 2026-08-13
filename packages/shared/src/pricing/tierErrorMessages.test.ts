import { describe, expect, it } from 'vitest'
import { listingPricingSchema } from '../schemas/listing'
import { tierValidationIssuesToFieldErrors } from './tierErrorMessages'

function tiers(...rows: Array<[number, number | null, number]>) {
  return rows.map(([minQty, maxQty, unitPricePaise]) => ({ minQty, maxQty, unitPricePaise }))
}

function issuesFor(pricing: { moq: number; stepQty?: number; tiers: ReturnType<typeof tiers> }) {
  const parsed = listingPricingSchema.safeParse(pricing)
  if (parsed.success) throw new Error('expected pricing to be invalid for this test')
  return parsed.error.issues
}

describe('tierValidationIssuesToFieldErrors', () => {
  it('flags a gap between tiers as tierMustStartAfterPrevious with the exact expected boundary', () => {
    const pricing = { moq: 10, stepQty: 1, tiers: tiers([10, 49, 100], [51, null, 90]) }
    const errors = tierValidationIssuesToFieldErrors(pricing, issuesFor(pricing))
    const gapError = errors.find((e) => e.code === 'tierMustStartAfterPrevious')
    expect(gapError).toBeDefined()
    expect(gapError?.params).toEqual({
      tierNumber: 2,
      expectedMinQty: 50,
      previousTierNumber: 1,
      previousMaxQty: 49,
    })
  })

  it('flags the first tier not matching MOQ as firstTierMustMatchMoq', () => {
    const pricing = { moq: 10, stepQty: 1, tiers: tiers([5, null, 100]) }
    const errors = tierValidationIssuesToFieldErrors(pricing, issuesFor(pricing))
    expect(errors.some((e) => e.code === 'firstTierMustMatchMoq' && e.params.moq === 10)).toBe(true)
  })

  it('flags a non-decreasing price as tierPriceMustBeLower', () => {
    const pricing = { moq: 10, stepQty: 1, tiers: tiers([10, 49, 100], [50, null, 110]) }
    const errors = tierValidationIssuesToFieldErrors(pricing, issuesFor(pricing))
    const priceError = errors.find((e) => e.code === 'tierPriceMustBeLower')
    expect(priceError?.params).toEqual({ tierNumber: 2, previousTierNumber: 1 })
  })

  it('flags a closed last tier as tierMustBeOpenEnded', () => {
    const pricing = { moq: 10, stepQty: 1, tiers: tiers([10, 49, 100], [50, 99, 90]) }
    const errors = tierValidationIssuesToFieldErrors(pricing, issuesFor(pricing))
    expect(errors.some((e) => e.code === 'tierMustBeOpenEnded' && e.params.tierNumber === 2)).toBe(true)
  })

  it('flags an open-ended non-last tier as onlyLastTierOpenEnded', () => {
    const pricing = { moq: 10, stepQty: 1, tiers: tiers([10, null, 100], [50, null, 90]) }
    const errors = tierValidationIssuesToFieldErrors(pricing, issuesFor(pricing))
    expect(errors.some((e) => e.code === 'onlyLastTierOpenEnded' && e.params.tierNumber === 1)).toBe(true)
  })

  it('flags maxQty < minQty on a non-last, non-open-ended tier as maxMustBeAtLeastMin', () => {
    const pricing = { moq: 10, stepQty: 1, tiers: tiers([10, 5, 100], [50, null, 90]) }
    const errors = tierValidationIssuesToFieldErrors(pricing, issuesFor(pricing))
    expect(errors.some((e) => e.code === 'maxMustBeAtLeastMin' && e.params.tierNumber === 1)).toBe(true)
  })

  it('flags moq not a multiple of stepQty as moqMustBeMultipleOfStep', () => {
    const pricing = { moq: 7, stepQty: 5, tiers: tiers([7, null, 100]) }
    const errors = tierValidationIssuesToFieldErrors(pricing, issuesFor(pricing))
    expect(errors.some((e) => e.code === 'moqMustBeMultipleOfStep' && e.params.stepQty === 5)).toBe(true)
  })
})
