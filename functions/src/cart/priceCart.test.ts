import type { CartLineWarning, CatalogPart, Coupon, Listing } from '@snapspare/shared'
import { describe, expect, it } from 'vitest'
import { applyCouponRules, resolveQty } from './priceCart.js'

function listingWith(overrides: Partial<{ moq: number; stepQty: number; stockQty: number; maxOrderQty?: number }> = {}): Listing {
  const { moq = 1, stepQty = 1, stockQty = 1000, maxOrderQty } = overrides
  return {
    id: 'listing-1',
    pricing: { moq, stepQty, tiers: [{ minQty: moq, maxQty: null, unitPricePaise: 100_00 }] },
    stockQty,
    maxOrderQty,
  } as Listing
}

describe('resolveQty (MOQ + step rounding)', () => {
  it('passes a qty already on the [moq, step] grid through unchanged, with no warnings', () => {
    const listing = listingWith({ moq: 5, stepQty: 5 })
    const warnings: CartLineWarning[] = []
    expect(resolveQty(listing, 10, warnings)).toBe(10)
    expect(warnings).toEqual([])
  })

  it('snaps a qty below moq up to moq, with a qty_adjusted_to_moq warning', () => {
    const listing = listingWith({ moq: 5, stepQty: 1 })
    const warnings: CartLineWarning[] = []
    expect(resolveQty(listing, 3, warnings)).toBe(5)
    expect(warnings).toEqual([{ code: 'qty_adjusted_to_moq', requestedQty: 3, adjustedQty: 5 }])
  })

  it('accepts qty exactly at moq with no warning', () => {
    const listing = listingWith({ moq: 5, stepQty: 1 })
    const warnings: CartLineWarning[] = []
    expect(resolveQty(listing, 5, warnings)).toBe(5)
    expect(warnings).toEqual([])
  })

  it('rounds a qty that lands between step increments to the nearest step', () => {
    // moq=10, step=10: requesting 23 is 1.3 steps past moq → rounds to 1 step → 20
    const listing = listingWith({ moq: 10, stepQty: 10 })
    const warnings: CartLineWarning[] = []
    expect(resolveQty(listing, 23, warnings)).toBe(20)
    expect(warnings).toEqual([{ code: 'qty_adjusted_to_step', requestedQty: 23, adjustedQty: 20 }])
  })

  it('rounds up to the next step when past the midpoint', () => {
    // moq=10, step=10: requesting 26 is 1.6 steps past moq → rounds to 2 steps → 30
    const listing = listingWith({ moq: 10, stepQty: 10 })
    const warnings: CartLineWarning[] = []
    expect(resolveQty(listing, 26, warnings)).toBe(30)
  })

  it('applies both the moq floor and step snapping together when a qty is below moq and off-grid', () => {
    // moq=10, step=10: requesting 3 first snaps up to moq (10), which is already on-grid, so only one warning fires
    const listing = listingWith({ moq: 10, stepQty: 10 })
    const warnings: CartLineWarning[] = []
    expect(resolveQty(listing, 3, warnings)).toBe(10)
    expect(warnings).toEqual([{ code: 'qty_adjusted_to_moq', requestedQty: 3, adjustedQty: 10 }])
  })

  it('caps qty at stockQty when the snapped qty would exceed available stock', () => {
    const listing = listingWith({ moq: 10, stepQty: 10, stockQty: 25 })
    const warnings: CartLineWarning[] = []
    // Requesting 40 snaps to 40 (already on-grid), but only 25 in stock → caps down to the nearest step at/under stock (20)
    expect(resolveQty(listing, 40, warnings)).toBe(20)
    expect(warnings.some((w) => w.code === 'qty_capped_to_stock')).toBe(true)
  })

  it('caps qty at maxOrderQty even when stock is plentiful', () => {
    const listing = listingWith({ moq: 1, stepQty: 1, stockQty: 1000, maxOrderQty: 12 })
    const warnings: CartLineWarning[] = []
    expect(resolveQty(listing, 50, warnings)).toBe(12)
    expect(warnings.some((w) => w.code === 'qty_capped_to_stock')).toBe(true)
  })

  it('returns 0 with an out_of_stock warning when stockQty is zero', () => {
    const listing = listingWith({ stockQty: 0 })
    const warnings: CartLineWarning[] = []
    expect(resolveQty(listing, 5, warnings)).toBe(0)
    expect(warnings).toEqual([{ code: 'out_of_stock', requestedQty: 5 }])
  })

  it('returns 0 with an out_of_stock warning when the capped quantity would fall back below moq', () => {
    // moq=10, but only 5 in stock: even the smallest valid tier quantity can't be filled
    const listing = listingWith({ moq: 10, stepQty: 10, stockQty: 5 })
    const warnings: CartLineWarning[] = []
    expect(resolveQty(listing, 10, warnings)).toBe(0)
    expect(warnings.some((w) => w.code === 'out_of_stock')).toBe(true)
  })
})

const nowMs = Date.now()
const ONE_DAY_MS = 24 * 60 * 60_000

function percentCoupon(overrides: Partial<Coupon> = {}): Coupon {
  return {
    id: 'coupon-1',
    code: 'SAVE10',
    usedCount: 0,
    validFrom: nowMs - ONE_DAY_MS,
    validUntil: nowMs + ONE_DAY_MS,
    status: 'active',
    createdAt: nowMs,
    updatedAt: nowMs,
    discountType: 'percent',
    discountPercent: 10,
    ...overrides,
  } as Coupon
}

function flatCoupon(overrides: Partial<Coupon> = {}): Coupon {
  return {
    id: 'coupon-2',
    code: 'FLAT100',
    usedCount: 0,
    validFrom: nowMs - ONE_DAY_MS,
    validUntil: nowMs + ONE_DAY_MS,
    status: 'active',
    createdAt: nowMs,
    updatedAt: nowMs,
    discountType: 'flat',
    discountAmountPaise: 100_00,
    ...overrides,
  } as Coupon
}

function line(overrides: Partial<{ sellerId: string; listingId: string; categorySlug: string; lineSubtotalPaise: number }> = {}) {
  const { sellerId = 'seller-1', listingId = 'listing-1', categorySlug, lineSubtotalPaise = 1000_00 } = overrides
  return {
    sellerId,
    listing: { id: listingId } as Listing,
    catalogPart: categorySlug ? ({ categorySlug } as CatalogPart) : undefined,
    lineSubtotalPaise,
  }
}

describe('applyCouponRules', () => {
  it('rejects an inactive coupon', () => {
    const { result } = applyCouponRules(percentCoupon({ status: 'inactive' }), 1000_00, [line()])
    expect(result).toEqual({ status: 'rejected', code: 'SAVE10', reason: 'inactive' })
  })

  it('rejects a coupon before its validFrom date', () => {
    const { result } = applyCouponRules(percentCoupon({ validFrom: nowMs + ONE_DAY_MS }), 1000_00, [line()])
    expect(result).toEqual({ status: 'rejected', code: 'SAVE10', reason: 'not_yet_valid' })
  })

  it('rejects a coupon past its validUntil date', () => {
    const { result } = applyCouponRules(percentCoupon({ validUntil: nowMs - 1 }), 1000_00, [line()])
    expect(result).toEqual({ status: 'rejected', code: 'SAVE10', reason: 'expired' })
  })

  it('rejects a coupon once its total usage limit is reached', () => {
    const { result } = applyCouponRules(percentCoupon({ usageLimitTotal: 5, usedCount: 5 }), 1000_00, [line()])
    expect(result).toEqual({ status: 'rejected', code: 'SAVE10', reason: 'usage_limit_reached' })
  })

  it('allows a coupon one usage under its total limit', () => {
    const { result } = applyCouponRules(percentCoupon({ usageLimitTotal: 5, usedCount: 4 }), 1000_00, [line()])
    expect(result.status).toBe('applied')
  })

  it('rejects a coupon when the cart subtotal is below minOrderValuePaise', () => {
    const { result } = applyCouponRules(percentCoupon({ minOrderValuePaise: 2000_00 }), 1000_00, [line()])
    expect(result).toEqual({ status: 'rejected', code: 'SAVE10', reason: 'min_order_not_met', minOrderValuePaise: 2000_00 })
  })

  it('rejects when no line matches the applicable seller restriction', () => {
    const { result } = applyCouponRules(percentCoupon({ applicableSellerIds: ['seller-9'] }), 1000_00, [line({ sellerId: 'seller-1' })])
    expect(result).toEqual({ status: 'rejected', code: 'SAVE10', reason: 'not_applicable_to_cart' })
  })

  it('applies only to lines from the applicable seller when others are present', () => {
    const { result, discountBySellerAndListing } = applyCouponRules(
      percentCoupon({ applicableSellerIds: ['seller-1'] }),
      1500_00,
      [line({ sellerId: 'seller-1', listingId: 'listing-a', lineSubtotalPaise: 1000_00 }), line({ sellerId: 'seller-2', listingId: 'listing-b', lineSubtotalPaise: 500_00 })],
    )
    expect(result).toEqual({ status: 'applied', code: 'SAVE10', discountPaise: 100_00 })
    expect(discountBySellerAndListing.get('seller-1:listing-a')).toBe(100_00)
    expect(discountBySellerAndListing.has('seller-2:listing-b')).toBe(false)
  })

  it('rejects when no line matches the applicable category restriction', () => {
    const { result } = applyCouponRules(percentCoupon({ applicableCategorySlugs: ['brake-pads'] }), 1000_00, [
      line({ categorySlug: 'filters' }),
    ])
    expect(result).toEqual({ status: 'rejected', code: 'SAVE10', reason: 'not_applicable_to_cart' })
  })

  it('excludes a line with no catalogPart at all when a category restriction is set', () => {
    const { result } = applyCouponRules(percentCoupon({ applicableCategorySlugs: ['brake-pads'] }), 1000_00, [
      line({ categorySlug: undefined }),
    ])
    expect(result).toEqual({ status: 'rejected', code: 'SAVE10', reason: 'not_applicable_to_cart' })
  })

  it('computes a flat discount, capped at the eligible subtotal so it never goes negative', () => {
    const { result } = applyCouponRules(flatCoupon({ discountAmountPaise: 5000_00 }), 1000_00, [line({ lineSubtotalPaise: 1000_00 })])
    expect(result).toEqual({ status: 'applied', code: 'FLAT100', discountPaise: 1000_00 })
  })

  it('caps a percent discount at maxDiscountPaise when the raw percentage would exceed it', () => {
    // 10% of ₹5,000 = ₹500, but capped at ₹200
    const { result } = applyCouponRules(percentCoupon({ discountPercent: 10, maxDiscountPaise: 200_00 }), 5000_00, [
      line({ lineSubtotalPaise: 5000_00 }),
    ])
    expect(result).toEqual({ status: 'applied', code: 'SAVE10', discountPaise: 200_00 })
  })

  it('splits the discount proportionally across multiple eligible lines and the shares sum exactly to the total discount', () => {
    const { result, discountBySellerAndListing } = applyCouponRules(percentCoupon({ discountPercent: 10 }), 900_00, [
      line({ sellerId: 'seller-1', listingId: 'listing-a', lineSubtotalPaise: 300_00 }),
      line({ sellerId: 'seller-1', listingId: 'listing-b', lineSubtotalPaise: 600_00 }),
    ])
    expect(result).toEqual({ status: 'applied', code: 'SAVE10', discountPaise: 90_00 })
    const shareA = discountBySellerAndListing.get('seller-1:listing-a') ?? 0
    const shareB = discountBySellerAndListing.get('seller-1:listing-b') ?? 0
    expect(shareA + shareB).toBe(90_00)
    // Weighted 1:2 by line subtotal (300:600)
    expect(shareA).toBe(30_00)
    expect(shareB).toBe(60_00)
  })

  it('excludes a zero-value line from eligibility even if otherwise matching', () => {
    const { result } = applyCouponRules(percentCoupon(), 1000_00, [line({ lineSubtotalPaise: 0 })])
    expect(result).toEqual({ status: 'rejected', code: 'SAVE10', reason: 'not_applicable_to_cart' })
  })
})
