import { describe, expect, it } from 'vitest'
import { maskBankAccountNumber, maskGstin, maskIfsc, maskPan } from './mask'

describe('maskBankAccountNumber', () => {
  it('keeps only the last 4 digits visible', () => {
    expect(maskBankAccountNumber('123456781234')).toBe('••••••••1234')
  })

  it('masks entirely when shorter than the reveal window', () => {
    expect(maskBankAccountNumber('123')).toBe('•••')
  })
})

describe('maskIfsc', () => {
  it('keeps the bank code and last 2 chars visible', () => {
    expect(maskIfsc('HDFC0001234')).toBe('HDFC•••••34')
  })

  it('falls back to a short mask for unusually short input', () => {
    expect(maskIfsc('AB12')).toBe('••12')
  })
})

describe('maskGstin', () => {
  it('keeps the 2-digit state code and last 4 chars visible', () => {
    expect(maskGstin('27ABCDE1234F1Z5')).toBe('27•••••••••F1Z5')
  })
})

describe('maskPan', () => {
  it('keeps the first 4 and last 1 chars visible', () => {
    expect(maskPan('ABCDE1234F')).toBe('ABCD•••••F')
  })
})
