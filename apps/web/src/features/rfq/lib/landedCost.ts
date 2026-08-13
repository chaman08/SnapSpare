import type { RfqQuote } from '@snapspare/shared'
import { applyPercent } from '@snapspare/shared'

export interface LandedCostEstimate {
  subtotalPaise: number
  /** Only computed when the quote (or its linked listing snapshot) states a GST rate — a free-text RFQ quote that used a listingId still carries the seller's own hsnCode/gstRatePercent on the quote doc from submitRfqQuote.ts. Undefined when genuinely unknown. */
  taxEstimatePaise: number | undefined
  totalEstimatePaise: number | undefined
}

/**
 * A client-side *estimate* for the buyer's comparison view (requirement 4:
 * "landed cost including tax and shipping"). Deliberately not a full
 * priceCart-style computation: `sellers/{sellerId}` (GSTIN, hence
 * seller-vs-buyer state and shipping zone) is Cloud-Function/owner/admin-only
 * — see firestore.rules — so a buyer's browser has no way to know whether a
 * seller is in-state or not before accepting. Shipping is therefore shown as
 * "calculated at checkout" rather than a fabricated number; the true landed
 * cost (tax split + real shipping) locks in server-side inside
 * acceptRfqQuote.ts, which the order confirmation then reflects exactly.
 */
export function estimateLandedCost(quote: RfqQuote): LandedCostEstimate {
  const subtotalPaise = quote.unitPricePaise * quote.qtyOffered
  const taxEstimatePaise = quote.gstRatePercent !== undefined ? applyPercent(subtotalPaise, quote.gstRatePercent) : undefined
  const totalEstimatePaise = taxEstimatePaise !== undefined ? subtotalPaise + taxEstimatePaise : undefined
  return { subtotalPaise, taxEstimatePaise, totalEstimatePaise }
}
