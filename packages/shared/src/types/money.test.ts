import { describe, expect, it } from 'vitest'
import { applyPercent, formatINR, fromPaise, paiseSchema, splitProportionally, toPaise } from './money'

describe('formatINR', () => {
  it('groups digits the Indian way', () => {
    expect(formatINR(12000000)).toBe('₹1,20,000')
  })

  it('shows paise remainder when non-zero', () => {
    expect(formatINR(150050)).toBe('₹1,500.50')
  })

  it('omits decimals when paise remainder is zero', () => {
    expect(formatINR(10000)).toBe('₹100')
  })
})

describe('paiseSchema', () => {
  it('rejects non-integer amounts', () => {
    expect(paiseSchema.safeParse(100.5).success).toBe(false)
  })

  it('rejects negative amounts', () => {
    expect(paiseSchema.safeParse(-100).success).toBe(false)
  })

  it('accepts zero', () => {
    expect(paiseSchema.safeParse(0).success).toBe(true)
  })
})

describe('toPaise / fromPaise', () => {
  it('round-trips a rupee amount', () => {
    expect(toPaise(1500.5)).toBe(150050)
    expect(fromPaise(150050)).toBe(1500.5)
  })

  it('rounds fractional-paisa rupee input to the nearest paisa', () => {
    expect(toPaise(10.005)).toBe(1001) // 10.005 * 100 = 1000.5 -> rounds to 1001
  })
})

describe('applyPercent', () => {
  it('computes an exact percentage', () => {
    expect(applyPercent(100000, 18)).toBe(18000)
  })

  it('rounds to the nearest paisa', () => {
    expect(applyPercent(10000, 33.33)).toBe(3333)
  })
})

describe('splitProportionally', () => {
  it('splits evenly when weights are equal', () => {
    expect(splitProportionally(300, [1, 1, 1])).toEqual([100, 100, 100])
  })

  it('sums to exactly totalPaise even when it does not divide evenly', () => {
    const parts = splitProportionally(100, [1, 1, 1])
    expect(parts.reduce((sum, p) => sum + p, 0)).toBe(100)
    expect(parts).toEqual([34, 33, 33])
  })

  it('gives the leftover paisa to the largest-remainder shares first, in index order on ties', () => {
    // weights 1,1,1,1 over 101 paise: each raw share is 25.25, base 25 each,
    // remainder 1 -> the single extra paisa goes to index 0 (first tie).
    const parts = splitProportionally(101, [1, 1, 1, 1])
    expect(parts).toEqual([26, 25, 25, 25])
    expect(parts.reduce((sum, p) => sum + p, 0)).toBe(101)
  })

  it('weights the split proportionally to line values', () => {
    // Distributing a 90-paise order-level discount across lines worth 100/200/300 paise.
    const parts = splitProportionally(90, [100, 200, 300])
    expect(parts).toEqual([15, 30, 45])
    expect(parts.reduce((sum, p) => sum + p, 0)).toBe(90)
  })

  it('falls back to an even split when every weight is zero', () => {
    const parts = splitProportionally(10, [0, 0, 0])
    expect(parts.reduce((sum, p) => sum + p, 0)).toBe(10)
  })

  it('rejects a negative total', () => {
    expect(() => splitProportionally(-1, [1])).toThrow()
  })
})
