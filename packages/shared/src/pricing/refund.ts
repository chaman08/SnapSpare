import type { SubOrderItem } from '../schemas/subOrder'
import type { Paise } from '../types/money'

export interface LineRefund {
  subtotalPaise: Paise
  discountPaise: Paise
  taxPaise: Paise
  totalPaise: Paise
}

/**
 * Computes a full or partial refund for one subOrder line item, scaling
 * `lineSubtotalPaise`/`lineDiscountPaise`/`lineTaxPaise`/`lineTotalPaise`
 * proportionally by `refundQty / item.qty` — the discount and tax reversal
 * the design brief asks for ("computed from the original line values
 * including proportional discount and tax reversal"). Each component is
 * rounded independently (same approach as
 * functions/src/tax/buildInvoiceLines.ts's `scaleInvoiceLineForReturn`,
 * which this mirrors for the buyer-facing refund amount rather than the
 * invoice/credit-note tax breakdown) rather than deriving `totalPaise` by
 * subtraction, so a caller refunding every line of an order sums to exactly
 * the order total component-by-component.
 */
export function computeLineRefund(item: SubOrderItem, refundQty: number): LineRefund {
  if (refundQty <= 0 || refundQty > item.qty) {
    throw new Error('computeLineRefund: refundQty must be between 1 and the line qty')
  }
  const ratio = refundQty / item.qty
  const scale = (paise: number) => Math.round(paise * ratio)
  return {
    subtotalPaise: scale(item.lineSubtotalPaise),
    discountPaise: scale(item.lineDiscountPaise),
    taxPaise: scale(item.lineTaxPaise),
    totalPaise: scale(item.lineTotalPaise),
  }
}

/** Sums several line refunds (a multi-line return/cancellation) into one total. */
export function sumLineRefunds(refunds: LineRefund[]): LineRefund {
  return refunds.reduce(
    (sum, r) => ({
      subtotalPaise: sum.subtotalPaise + r.subtotalPaise,
      discountPaise: sum.discountPaise + r.discountPaise,
      taxPaise: sum.taxPaise + r.taxPaise,
      totalPaise: sum.totalPaise + r.totalPaise,
    }),
    { subtotalPaise: 0, discountPaise: 0, taxPaise: 0, totalPaise: 0 },
  )
}
