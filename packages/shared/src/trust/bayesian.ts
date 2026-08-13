/**
 * Bayesian ("weighted") average — pulls a low-count rating toward a platform
 * prior so a single 5-star review can't outrank a seller/listing/part with
 * hundreds of reviews averaging a lower but far better-evidenced score. See
 * functions/src/reviews/onReviewWrite.ts, the only caller.
 */
export interface BayesianAverageInput {
  /** Sum of every published review's rating for this entity. */
  sum: number
  /** Count of published reviews summed above. */
  count: number
  /** Platform-wide prior mean rating (e.g. 3.8) — what an entity with zero reviews is assumed to be worth. */
  priorMean: number
  /** How many "phantom" prior-mean reviews to blend in — higher means more reviews are needed before the raw average dominates. */
  priorWeight: number
}

export function bayesianAverage({ sum, count, priorMean, priorWeight }: BayesianAverageInput): number {
  return (priorMean * priorWeight + sum) / (priorWeight + count)
}
