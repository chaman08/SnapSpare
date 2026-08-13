import type { AuthenticityProvider, VerifyCodeParams, VerifyCodeResult } from './authenticityProvider.js'

/**
 * Dev/demo stand-in for a real brand-registry QR/hologram lookup — no such
 * partnership/API exists in this environment, same reasoning that kept
 * payments/mockPayoutProvider.ts and shipping's provider mock-only.
 * Deterministic: codes ending in an even digit report valid (so demo flows
 * can exercise both outcomes without external state), any other code
 * reports unknown/invalid.
 */
export class MockAuthenticityProvider implements AuthenticityProvider {
  async verifyCode(params: VerifyCodeParams): Promise<VerifyCodeResult> {
    await Promise.resolve()
    const lastDigit = params.code.trim().slice(-1)
    const isEven = /[02468]/.test(lastDigit)
    if (isEven) {
      return { valid: true, brand: params.brandHint, message: 'Code matches the brand registry (mock).' }
    }
    return { valid: false, message: 'Code could not be verified against any brand registry (mock).' }
  }
}

export function getAuthenticityProvider(): AuthenticityProvider {
  return new MockAuthenticityProvider()
}
