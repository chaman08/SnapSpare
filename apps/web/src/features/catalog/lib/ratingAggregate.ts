import type { Review } from '@snapspare/shared'

export interface RatingAggregate {
  average: number
  count: number
}

export function aggregateRatings(reviews: Review[]): RatingAggregate {
  if (reviews.length === 0) return { average: 0, count: 0 }
  const total = reviews.reduce((sum, review) => sum + review.rating, 0)
  return { average: total / reviews.length, count: reviews.length }
}
