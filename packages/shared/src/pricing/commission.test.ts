import { describe, expect, it } from 'vitest'
import type { CommissionConfig } from '../schemas/commissionConfig'
import { computeCommission } from './commission'

const BASE_CONFIG: CommissionConfig = {
  id: 'commission',
  categoryRates: {
    tyres: { percent: 8, flatFeePaise: 500 },
  },
  promotions: [],
  settlementCycleDays: 7,
  creditOverdueGraceDays: 7,
  updatedAt: 0,
}

describe('computeCommission', () => {
  it('falls back to the platform default when no category or override applies', () => {
    const result = computeCommission(
      { taxableValuePaise: 100_00, categorySlug: undefined, sellerId: 's1', platformDefaultPercent: 10, now: 0 },
      BASE_CONFIG,
    )
    expect(result.source).toBe('platform_default')
    expect(result.percent).toBe(10)
    expect(result.totalPaise).toBe(10_00)
  })

  it('uses the category rate plus flat fee over the platform default', () => {
    const result = computeCommission(
      { taxableValuePaise: 100_00, categorySlug: 'tyres', sellerId: 's1', platformDefaultPercent: 10, now: 0 },
      BASE_CONFIG,
    )
    expect(result.source).toBe('category')
    expect(result.percentAmountPaise).toBe(8_00)
    expect(result.flatFeePaise).toBe(500)
    expect(result.totalPaise).toBe(8_00 + 500)
  })

  it('prefers a per-seller override over the category rate', () => {
    const result = computeCommission(
      {
        taxableValuePaise: 100_00,
        categorySlug: 'tyres',
        sellerId: 's1',
        sellerOverridePercent: 3,
        platformDefaultPercent: 10,
        now: 0,
      },
      BASE_CONFIG,
    )
    expect(result.source).toBe('seller_override')
    expect(result.percent).toBe(3)
    expect(result.flatFeePaise).toBe(0)
    expect(result.totalPaise).toBe(3_00)
  })

  it('prefers an active promotion over everything else, including a seller override', () => {
    const config: CommissionConfig = {
      ...BASE_CONFIG,
      promotions: [{ scope: 'seller', sellerId: 's1', percent: 0, startAt: 0, endAt: 1_000 }],
    }
    const result = computeCommission(
      {
        taxableValuePaise: 100_00,
        categorySlug: 'tyres',
        sellerId: 's1',
        sellerOverridePercent: 3,
        platformDefaultPercent: 10,
        now: 500,
      },
      config,
    )
    expect(result.source).toBe('promotion')
    expect(result.totalPaise).toBe(0)
  })

  it('ignores a promotion outside its active window', () => {
    const config: CommissionConfig = {
      ...BASE_CONFIG,
      promotions: [{ scope: 'seller', sellerId: 's1', percent: 0, startAt: 0, endAt: 1_000 }],
    }
    const result = computeCommission(
      { taxableValuePaise: 100_00, categorySlug: undefined, sellerId: 's1', platformDefaultPercent: 10, now: 2_000 },
      config,
    )
    expect(result.source).toBe('platform_default')
  })

  it('does not apply a category-scoped promotion to a different category', () => {
    const config: CommissionConfig = {
      ...BASE_CONFIG,
      promotions: [{ scope: 'category', categorySlug: 'batteries', percent: 0, startAt: 0, endAt: 1_000 }],
    }
    const result = computeCommission(
      { taxableValuePaise: 100_00, categorySlug: 'tyres', sellerId: 's1', platformDefaultPercent: 10, now: 500 },
      config,
    )
    expect(result.source).toBe('category')
  })
})
