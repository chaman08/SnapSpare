import type { PayoutProvider, PayToBankParams, PayToBankResult } from './payoutProvider.js'

/**
 * Dev/test stand-in for a real bank-transfer API (e.g. RazorpayX Payouts) —
 * no payout-capable credentials exist in this environment, same reasoning
 * that kept functions/src/shipping/provider.ts mock-only. Always succeeds
 * instantly with a fake UTR derived from the reference, so payout-run and
 * COD-refund tests are deterministic.
 */
export class MockPayoutProvider implements PayoutProvider {
  async payToBank(params: PayToBankParams): Promise<PayToBankResult> {
    await Promise.resolve()
    return { utr: `MOCKUTR${params.reference.slice(0, 12).toUpperCase()}${Date.now()}`, status: 'processed' }
  }
}
