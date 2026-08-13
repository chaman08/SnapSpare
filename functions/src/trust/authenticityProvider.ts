export interface VerifyCodeParams {
  code: string
  /** Optional hint from the scanning context (e.g. the listing's catalogPart.brand) — a real brand-registry API may need it to route the lookup to the right brand's registry. */
  brandHint?: string
}

export interface VerifyCodeResult {
  valid: boolean
  brand?: string
  message?: string
}

/**
 * Design brief item 4's "optional per-item QR/hologram verification hook":
 * an adapter so a real brand-registry API can be wired in later without
 * touching verifyPartAuthenticity.ts — same swap-point shape as
 * payments/payoutProvider.ts and shipping/provider.ts. No real integration
 * exists yet; see mockAuthenticityProvider.ts for the dev/demo stand-in.
 */
export interface AuthenticityProvider {
  verifyCode(params: VerifyCodeParams): Promise<VerifyCodeResult>
}
