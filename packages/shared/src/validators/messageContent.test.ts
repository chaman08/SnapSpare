import { describe, expect, it } from 'vitest'
import { findContactInfo, findProfanity, looksLikePII } from './messageContent'

describe('findContactInfo', () => {
  it('returns null for ordinary negotiation text', () => {
    expect(findContactInfo('Can you do 200 units at this price by Friday?')).toBeNull()
  })

  it('detects a bare 10-digit mobile number', () => {
    expect(findContactInfo('call me at 9876543210')).toBe('phone')
  })

  it('detects a spaced/dashed mobile number', () => {
    expect(findContactInfo('reach me on 98765-43210 anytime')).toBe('phone')
    expect(findContactInfo('+91 98765 43210')).toBe('phone')
  })

  it('detects an email address', () => {
    expect(findContactInfo('mail me at buyer@example.com instead')).toBe('email')
  })

  it('does not flag a short quantity or price mention', () => {
    expect(findContactInfo('I need 50000 units at 12000 paise each')).toBeNull()
  })
})

describe('findProfanity', () => {
  it('returns false for ordinary review text', () => {
    expect(findProfanity('Great fit, arrived fast, exactly as described.')).toBe(false)
  })

  it('detects a denylisted word', () => {
    expect(findProfanity('This is absolute shit quality')).toBe(true)
  })

  it('does not flag a word merely containing a denylisted substring', () => {
    expect(findProfanity('The class of part matters')).toBe(false)
  })

  it('is case-insensitive', () => {
    expect(findProfanity('total BASTARD of a seller')).toBe(true)
  })
})

describe('looksLikePII', () => {
  it('returns false for ordinary review text', () => {
    expect(looksLikePII('Fits my Swift VDI perfectly, five stars.')).toBe(false)
  })

  it('detects a PAN-shaped string', () => {
    expect(looksLikePII('my pan is ABCDE1234F if needed')).toBe(true)
  })

  it('detects a 12-digit Aadhaar-shaped run, spacing tolerant', () => {
    expect(looksLikePII('aadhaar 1234 5678 9012')).toBe(true)
  })

  it('does not flag a 10-digit order number', () => {
    expect(looksLikePII('order number 9876543210')).toBe(false)
  })
})
