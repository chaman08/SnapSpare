import { MockPayoutProvider } from './mockPayoutProvider.js'
import type { PayoutProvider } from './payoutProvider.js'

/**
 * Single swap point, same pattern as functions/src/shipping/provider.ts.
 * Swap for a real bank-transfer API (e.g. RazorpayX Payouts, which needs a
 * separate account activation this environment doesn't have) before
 * production launch:
 *
 *   import { RazorpayXPayoutProvider } from './razorpayXPayoutProvider.js'
 *   export const payoutProvider: PayoutProvider = new RazorpayXPayoutProvider(
 *     RAZORPAYX_ACCOUNT_NUMBER.value(),
 *     RAZORPAYX_KEY_SECRET.value(),
 *   )
 *
 * Used by both functions/src/payments/refundEngine.ts (COD refund-to-bank)
 * and functions/src/payments/runSellerPayouts.ts (seller settlement) — see
 * their doc comments.
 */
export const payoutProvider: PayoutProvider = new MockPayoutProvider()
