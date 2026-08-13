import { describe, expect, it } from 'vitest'
import { bayesianAverage } from './bayesian'

describe('bayesianAverage', () => {
  it('returns the prior mean when there are no reviews yet', () => {
    expect(bayesianAverage({ sum: 0, count: 0, priorMean: 3.8, priorWeight: 15 })).toBeCloseTo(3.8)
  })

  it('pulls a single 5-star review most of the way toward the prior', () => {
    const score = bayesianAverage({ sum: 5, count: 1, priorMean: 3.8, priorWeight: 15 })
    expect(score).toBeCloseTo((3.8 * 15 + 5) / 16)
    expect(score).toBeLessThan(4)
  })

  it('lets a well-evidenced 4.6 average outrank a single 5-star review', () => {
    const manyReviews = bayesianAverage({ sum: 4.6 * 200, count: 200, priorMean: 3.8, priorWeight: 15 })
    const oneReview = bayesianAverage({ sum: 5, count: 1, priorMean: 3.8, priorWeight: 15 })
    expect(manyReviews).toBeGreaterThan(oneReview)
  })

  it('converges toward the raw average as count grows large relative to priorWeight', () => {
    const score = bayesianAverage({ sum: 4.6 * 10000, count: 10000, priorMean: 3.8, priorWeight: 15 })
    expect(score).toBeCloseTo(4.6, 2)
  })
})
