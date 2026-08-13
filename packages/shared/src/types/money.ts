import { z } from 'zod'

/**
 * All money in SnapSpare is represented as an integer number of paise
 * (1 INR = 100 paise). Never use floats for currency. Server-side Cloud
 * Functions are the only place amounts are computed; this schema just
 * validates the shape everywhere else.
 */
export const paiseSchema = z.number().int().nonnegative()

export type Paise = z.infer<typeof paiseSchema>

const INDIAN_GROUPING = /(\d)(?=(\d\d)+\d$)/g

/** Formats integer paise as a ₹-prefixed string with Indian digit grouping, e.g. 12000000 -> "₹1,20,000". */
export function formatINR(paise: Paise): string {
  const rupees = Math.floor(paise / 100)
  const remainderPaise = paise % 100
  const rupeesStr = String(rupees).replace(INDIAN_GROUPING, '$1,')
  return remainderPaise === 0
    ? `₹${rupeesStr}`
    : `₹${rupeesStr}.${String(remainderPaise).padStart(2, '0')}`
}

/** Converts a rupee amount (e.g. from a form input) to integer paise, rounding to the nearest paisa. */
export function toPaise(rupees: number): Paise {
  return Math.round(rupees * 100)
}

/** Converts integer paise back to a rupee amount. Only for display/input defaults — never for further money math. */
export function fromPaise(paise: Paise): number {
  return paise / 100
}

/** Applies a percentage to a paise amount, rounding to the nearest paisa (used for GST, discounts, commission). */
export function applyPercent(amountPaise: Paise, percent: number): Paise {
  return Math.round((amountPaise * percent) / 100)
}

/**
 * Distributes `totalPaise` across `weights` proportionally, guaranteeing the
 * returned amounts sum to exactly `totalPaise` (largest-remainder method).
 * Used to spread an order-level discount/shipping charge across line items
 * without ever losing or inventing a paisa to rounding.
 */
export function splitProportionally(totalPaise: Paise, weights: number[]): Paise[] {
  if (totalPaise < 0) throw new Error('splitProportionally: totalPaise must be nonnegative')
  if (weights.length === 0) throw new Error('splitProportionally: weights must be non-empty')
  if (weights.some((w) => w < 0)) throw new Error('splitProportionally: weights must be nonnegative')

  const weightSum = weights.reduce((sum, w) => sum + w, 0)
  // If every weight is zero there's nothing to weight by — split evenly instead of dividing by zero.
  const effectiveWeights = weightSum === 0 ? weights.map(() => 1) : weights
  const effectiveSum = weightSum === 0 ? weights.length : weightSum

  const rawShares = effectiveWeights.map((w) => (totalPaise * w) / effectiveSum)
  const baseShares = rawShares.map((share) => Math.floor(share))
  const remainder = totalPaise - baseShares.reduce((sum, s) => sum + s, 0)

  const remainderOrder = rawShares
    .map((share, index) => ({ index, fraction: share - Math.floor(share) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index)

  const result = [...baseShares]
  for (let i = 0; i < remainder; i++) {
    const target = remainderOrder[i]
    if (target) result[target.index] = (result[target.index] ?? 0) + 1
  }

  return result
}
