interface IfscLookupResult {
  bankName: string
  branch: string
}

/**
 * Direct client-side fetch against Razorpay's public IFSC lookup API
 * (unauthenticated GET, no secret involved — same "call a third party
 * directly from the browser" pattern this app already uses for Typesense
 * search). Returns null on any failure (offline, unknown code, endpoint
 * down) so the caller can fall back to manual bank name/branch entry rather
 * than blocking the form.
 */
export async function lookupIfsc(ifsc: string): Promise<IfscLookupResult | null> {
  try {
    const response = await fetch(`https://ifsc.razorpay.com/${ifsc}`)
    if (!response.ok) return null
    const data = (await response.json()) as { BANK?: string; BRANCH?: string }
    if (!data.BANK) return null
    return { bankName: data.BANK, branch: data.BRANCH ?? '' }
  } catch {
    return null
  }
}
