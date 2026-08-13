import { describe, expect, it } from 'vitest'
import type { SubOrderItem } from '../schemas/subOrder'
import { computeLineRefund, sumLineRefunds } from './refund'

const ITEM: SubOrderItem = {
  listingId: 'listing-1',
  partId: 'part-1',
  sku: 'SKU-1',
  title: 'Brake pad set',
  qty: 4,
  unitPricePaise: 25_00,
  tierMinQtyApplied: 1,
  hsnCode: '870830',
  gstRatePercent: 18,
  lineSubtotalPaise: 100_00,
  lineDiscountPaise: 10_00,
  lineTaxPaise: 16_20,
  lineTotalPaise: 106_20,
}

describe('computeLineRefund', () => {
  it('refunds the full line 1:1 when refundQty equals the line qty', () => {
    const refund = computeLineRefund(ITEM, 4)
    expect(refund).toEqual({
      subtotalPaise: ITEM.lineSubtotalPaise,
      discountPaise: ITEM.lineDiscountPaise,
      taxPaise: ITEM.lineTaxPaise,
      totalPaise: ITEM.lineTotalPaise,
    })
  })

  it('scales every component proportionally for a partial-quantity return', () => {
    const refund = computeLineRefund(ITEM, 2) // half the line
    expect(refund.subtotalPaise).toBe(50_00)
    expect(refund.discountPaise).toBe(5_00)
    expect(refund.taxPaise).toBe(8_10)
    expect(refund.totalPaise).toBe(53_10)
  })

  it('rejects a refundQty of 0 or negative', () => {
    expect(() => computeLineRefund(ITEM, 0)).toThrow()
    expect(() => computeLineRefund(ITEM, -1)).toThrow()
  })

  it('rejects a refundQty greater than the line qty', () => {
    expect(() => computeLineRefund(ITEM, 5)).toThrow()
  })
})

describe('sumLineRefunds', () => {
  it('sums every component across multiple line refunds', () => {
    const a = computeLineRefund(ITEM, 1)
    const b = computeLineRefund(ITEM, 3)
    const sum = sumLineRefunds([a, b])
    // Refunding qty 1 then qty 3 of the same line should sum back to the full line.
    expect(sum.subtotalPaise).toBe(ITEM.lineSubtotalPaise)
    expect(sum.discountPaise).toBe(ITEM.lineDiscountPaise)
    expect(sum.totalPaise).toBe(ITEM.lineTotalPaise)
  })

  it('returns all zeros for an empty list', () => {
    expect(sumLineRefunds([])).toEqual({ subtotalPaise: 0, discountPaise: 0, taxPaise: 0, totalPaise: 0 })
  })
})
