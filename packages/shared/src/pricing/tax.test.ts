import { describe, expect, it } from 'vitest'
import {
  computeTcs,
  computeTds,
  DEFAULT_TAX_CONFIG,
  isSameStateSupply,
  requiresEwayBill,
  splitGst,
} from './tax'

describe('splitGst', () => {
  it('splits intra-state tax into equal CGST + SGST halves', () => {
    expect(splitGst(1000, false)).toEqual({ cgstPaise: 500, sgstPaise: 500, igstPaise: 0, totalPaise: 1000 })
  })

  it('gives the extra paise to CGST when the total is odd (largest-remainder-first split)', () => {
    expect(splitGst(1001, false)).toEqual({ cgstPaise: 501, sgstPaise: 500, igstPaise: 0, totalPaise: 1001 })
  })

  it('puts the full amount in IGST for inter-state supply, none in CGST/SGST', () => {
    expect(splitGst(1000, true)).toEqual({ cgstPaise: 0, sgstPaise: 0, igstPaise: 1000, totalPaise: 1000 })
  })

  it('handles a zero tax amount for both intra and inter-state', () => {
    expect(splitGst(0, false)).toEqual({ cgstPaise: 0, sgstPaise: 0, igstPaise: 0, totalPaise: 0 })
    expect(splitGst(0, true)).toEqual({ cgstPaise: 0, sgstPaise: 0, igstPaise: 0, totalPaise: 0 })
  })

  it('always sums back to the original total, intra or inter-state', () => {
    for (const taxPaise of [1, 2, 3, 99, 100, 12345, 999999]) {
      const intra = splitGst(taxPaise, false)
      expect(intra.cgstPaise + intra.sgstPaise + intra.igstPaise).toBe(taxPaise)
      const inter = splitGst(taxPaise, true)
      expect(inter.cgstPaise + inter.sgstPaise + inter.igstPaise).toBe(taxPaise)
    }
  })
})

describe('computeTcs', () => {
  it('computes 1% TCS on net taxable value, split CGST+SGST for intra-state', () => {
    // ₹1,00,000 net value → 1% = ₹1,000 = 1,00,000 paise
    const result = computeTcs(100000_00, false, DEFAULT_TAX_CONFIG)
    expect(result.totalPaise).toBe(1000_00)
    expect(result.cgstPaise).toBe(500_00)
    expect(result.sgstPaise).toBe(500_00)
    expect(result.igstPaise).toBe(0)
  })

  it('computes 1% TCS as IGST for inter-state supply', () => {
    const result = computeTcs(100000_00, true, DEFAULT_TAX_CONFIG)
    expect(result.totalPaise).toBe(1000_00)
    expect(result.igstPaise).toBe(1000_00)
    expect(result.cgstPaise).toBe(0)
    expect(result.sgstPaise).toBe(0)
  })

  it('rounds to the nearest paise on an odd-paise net value', () => {
    // 333 * 1% = 3.33 → rounds to 3
    expect(computeTcs(333, false, DEFAULT_TAX_CONFIG).totalPaise).toBe(3)
  })

  it('is zero for a zero net taxable value', () => {
    expect(computeTcs(0, false, DEFAULT_TAX_CONFIG).totalPaise).toBe(0)
  })

  it('respects a configured TCS rate other than 1%', () => {
    const config = { ...DEFAULT_TAX_CONFIG, tcsRatePercent: 2 }
    expect(computeTcs(100000_00, false, config).totalPaise).toBe(2000_00)
  })
})

describe('computeTds', () => {
  const nonIndividualTypes = ['partnership', 'pvt_ltd', 'llp', 'other'] as const

  it('applies no exemption threshold for non-individual/HUF-equivalent business types', () => {
    for (const sellerBusinessType of nonIndividualTypes) {
      const tds = computeTds(
        { grossSaleExGstPaise: 100_00, cumulativeFyGrossSaleExGstPaise: 0, sellerBusinessType },
        DEFAULT_TAX_CONFIG,
      )
      expect(tds).toBe(1_00) // 1% of ₹100, well under the individual threshold, still taxed
    }
  })

  it('is fully exempt for an individual seller whose cumulative FY sales stay at/under the threshold', () => {
    const tds = computeTds(
      {
        grossSaleExGstPaise: 100_00,
        cumulativeFyGrossSaleExGstPaise: DEFAULT_TAX_CONFIG.tdsIndividualHufExemptionThresholdPaise - 200_00,
        sellerBusinessType: 'individual',
      },
      DEFAULT_TAX_CONFIG,
    )
    expect(tds).toBe(0)
  })

  it('is exactly zero right at the threshold boundary (cumulative == threshold, not yet crossing)', () => {
    const tds = computeTds(
      {
        grossSaleExGstPaise: 0,
        cumulativeFyGrossSaleExGstPaise: DEFAULT_TAX_CONFIG.tdsIndividualHufExemptionThresholdPaise,
        sellerBusinessType: 'individual',
      },
      DEFAULT_TAX_CONFIG,
    )
    expect(tds).toBe(0)
  })

  it('taxes only the slice of this transaction that crosses the threshold, not the whole transaction', () => {
    // Already at threshold - 50 paise before this sale; this sale is 100 paise.
    // Only the 50 paise that crosses the line is taxable.
    const threshold = DEFAULT_TAX_CONFIG.tdsIndividualHufExemptionThresholdPaise
    const tds = computeTds(
      {
        grossSaleExGstPaise: 100,
        cumulativeFyGrossSaleExGstPaise: threshold - 50,
        sellerBusinessType: 'individual',
      },
      DEFAULT_TAX_CONFIG,
    )
    // 1% of the 50-paise taxable slice, rounded — effectively 1 paise (round(0.5) = 1 in JS's round-half-up for positive numbers... verify against Math.round semantics)
    expect(tds).toBe(Math.round((50 * DEFAULT_TAX_CONFIG.tdsRatePercent) / 100))
  })

  it('taxes the full transaction once cumulative sales are already well past the threshold', () => {
    const threshold = DEFAULT_TAX_CONFIG.tdsIndividualHufExemptionThresholdPaise
    const tds = computeTds(
      {
        grossSaleExGstPaise: 100000_00,
        cumulativeFyGrossSaleExGstPaise: threshold + 500000_00,
        sellerBusinessType: 'individual',
      },
      DEFAULT_TAX_CONFIG,
    )
    expect(tds).toBe(1000_00) // full 1% of ₹1,00,000
  })

  it('treats proprietorship the same as individual for the exemption threshold', () => {
    const tds = computeTds(
      {
        grossSaleExGstPaise: 100_00,
        cumulativeFyGrossSaleExGstPaise: 0,
        sellerBusinessType: 'proprietorship',
      },
      DEFAULT_TAX_CONFIG,
    )
    expect(tds).toBe(0)
  })

  it('is zero for a zero-value transaction regardless of business type', () => {
    expect(
      computeTds({ grossSaleExGstPaise: 0, cumulativeFyGrossSaleExGstPaise: 0, sellerBusinessType: 'pvt_ltd' }, DEFAULT_TAX_CONFIG),
    ).toBe(0)
  })
})

describe('isSameStateSupply', () => {
  it('is true when seller and buyer state codes match', () => {
    expect(isSameStateSupply('27', '27')).toBe(true)
  })

  it('is false when seller and buyer state codes differ', () => {
    expect(isSameStateSupply('27', '29')).toBe(false)
  })
})

describe('requiresEwayBill', () => {
  it('does not require an e-way bill below the threshold', () => {
    expect(requiresEwayBill(49999_00, DEFAULT_TAX_CONFIG)).toBe(false)
  })

  it('requires an e-way bill exactly at the threshold', () => {
    expect(requiresEwayBill(50000_00, DEFAULT_TAX_CONFIG)).toBe(true)
  })

  it('requires an e-way bill above the threshold', () => {
    expect(requiresEwayBill(50000_01, DEFAULT_TAX_CONFIG)).toBe(true)
  })
})
