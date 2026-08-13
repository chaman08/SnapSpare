import { describe, expect, it } from 'vitest'
import {
  computeGstinCheckDigit,
  gstinSchema,
  hsnSchema,
  ifscSchema,
  mobileSchema,
  panSchema,
  pincodeSchema,
} from './indian'

describe('computeGstinCheckDigit / gstinSchema', () => {
  // Publicly published, independently verifiable GSTIN (Uber India Systems Pvt Ltd).
  const REAL_GSTIN = '27AAPFU0939F1ZV'
  // Synthetic GSTIN built from a syntactically valid PAN, with the check
  // digit computed by the same mod-36 algorithm under test.
  const SYNTHETIC_GSTIN = '29ABCPD1234E1ZA'

  it('computes the correct check digit for a known real-world GSTIN', () => {
    expect(computeGstinCheckDigit(REAL_GSTIN.slice(0, 14))).toBe(REAL_GSTIN[14])
  })

  it('accepts a well-formed GSTIN with a correct check digit', () => {
    expect(gstinSchema.safeParse(REAL_GSTIN).success).toBe(true)
    expect(gstinSchema.safeParse(SYNTHETIC_GSTIN).success).toBe(true)
  })

  it('normalizes lowercase input before validating', () => {
    const result = gstinSchema.safeParse(REAL_GSTIN.toLowerCase())
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toBe(REAL_GSTIN)
  })

  it('rejects a tampered check digit', () => {
    const tampered = REAL_GSTIN.slice(0, 14) + (REAL_GSTIN[14] === 'V' ? 'W' : 'V')
    expect(gstinSchema.safeParse(tampered).success).toBe(false)
  })

  it('rejects the wrong length', () => {
    expect(gstinSchema.safeParse(REAL_GSTIN.slice(0, 14)).success).toBe(false)
  })

  it('rejects a structurally invalid GSTIN (bad state code position)', () => {
    expect(gstinSchema.safeParse('AA' + REAL_GSTIN.slice(2)).success).toBe(false)
  })
})

describe('panSchema', () => {
  it('accepts a well-formed PAN', () => {
    expect(panSchema.safeParse('ABCPD1234E').success).toBe(true)
  })

  it('normalizes lowercase input', () => {
    const result = panSchema.safeParse('abcpd1234e')
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toBe('ABCPD1234E')
  })

  it('rejects malformed PANs', () => {
    expect(panSchema.safeParse('ABCPD12345').success).toBe(false)
    expect(panSchema.safeParse('ABCP1234E').success).toBe(false)
  })
})

describe('pincodeSchema', () => {
  it('accepts a valid 6-digit pincode', () => {
    expect(pincodeSchema.safeParse('560001').success).toBe(true)
  })

  it('rejects a pincode starting with 0', () => {
    expect(pincodeSchema.safeParse('012345').success).toBe(false)
  })

  it('rejects the wrong length', () => {
    expect(pincodeSchema.safeParse('56001').success).toBe(false)
  })
})

describe('mobileSchema', () => {
  it.each(['6000000000', '7000000000', '8000000000', '9000000000'])(
    'accepts a 10-digit mobile number starting with %s',
    (mobile) => {
      expect(mobileSchema.safeParse(mobile).success).toBe(true)
    },
  )

  it.each(['5000000000', '0000000000', '1234567890'])('rejects %s (does not start 6-9)', (mobile) => {
    expect(mobileSchema.safeParse(mobile).success).toBe(false)
  })

  it('rejects the wrong length', () => {
    expect(mobileSchema.safeParse('900000000').success).toBe(false)
  })
})

describe('ifscSchema', () => {
  it('accepts a well-formed IFSC', () => {
    expect(ifscSchema.safeParse('HDFC0001234').success).toBe(true)
  })

  it('rejects an IFSC missing the reserved 0 in the 5th position', () => {
    expect(ifscSchema.safeParse('HDFC1001234').success).toBe(false)
  })
})

describe('hsnSchema', () => {
  it.each(['8708', '870829', '87082900'])('accepts a %s-character HSN code', (hsn) => {
    expect(hsnSchema.safeParse(hsn).success).toBe(true)
  })

  it.each(['870', '87082', '8708290'])('rejects an invalid-length HSN code %s', (hsn) => {
    expect(hsnSchema.safeParse(hsn).success).toBe(false)
  })
})
