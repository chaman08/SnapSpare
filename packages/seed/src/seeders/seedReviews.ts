import { reviewSchema } from '@snapspare/shared'
import { seedCollection } from '../lib/batch.js'
import { db } from '../lib/firebaseAdmin.js'
import { pick, randomInt, weightedBool } from '../lib/random.js'
import type { DeliveredPurchase } from './seedOrders.js'

const RATING_WEIGHTS: Array<[number, number]> = [
  [5, 0.5],
  [4, 0.3],
  [3, 0.12],
  [2, 0.05],
  [1, 0.03],
]

const POSITIVE_COMMENTS = [
  'Fit perfectly on the first try, exactly as described. Fast delivery too.',
  'Good quality for the price. Would order again from this seller.',
  'Genuine part, packaging was solid, no damage in transit.',
  'Works great, noticeably better than the local duplicate I had before.',
  'Ordered in bulk for the workshop, all pieces were consistent quality.',
]
const NEUTRAL_COMMENTS = [
  'Does the job but the finish is average compared to OEM.',
  'Took a bit longer to arrive than expected, part itself is fine.',
  'Fitment was close but needed minor adjustment during install.',
]
const NEGATIVE_COMMENTS = [
  'Did not match the listing photos, had to return for a refund.',
  'Packaging was poor and the part arrived with a scratch.',
]

const SELLER_REPLIES = [
  'Thank you for the feedback, glad it worked out well!',
  'Sorry to hear about this — please reach out to support so we can make it right.',
  'Appreciate the review, we have shared this with our packing team.',
]

function weightedRating(rng: () => number): number {
  const roll = rng()
  let cumulative = 0
  for (const [rating, weight] of RATING_WEIGHTS) {
    cumulative += weight
    if (roll < cumulative) return rating
  }
  return 5
}

export async function seedReviews(rng: () => number, deliveredPurchases: DeliveredPurchase[]): Promise<void> {
  const now = Date.now()
  const reviews = []
  let sequence = 0

  for (const purchase of deliveredPurchases) {
    if (!weightedBool(rng, 0.55)) continue
    sequence += 1

    const rating = weightedRating(rng)
    const comment =
      rating >= 4 ? pick(rng, POSITIVE_COMMENTS) : rating === 3 ? pick(rng, NEUTRAL_COMMENTS) : pick(rng, NEGATIVE_COMMENTS)
    const createdAt = now - randomInt(rng, 1, 90) * 86_400_000
    const status = weightedBool(rng, 0.92) ? 'published' : weightedBool(rng, 0.5) ? 'pending' : 'hidden'

    const review = reviewSchema.parse({
      id: `review-${sequence}`,
      orderId: purchase.orderId,
      subOrderId: purchase.subOrderId,
      listingId: purchase.listingId,
      partId: purchase.partId,
      sellerId: purchase.sellerId,
      buyerId: purchase.buyerId,
      buyerDisplayName: purchase.buyerDisplayName,
      rating,
      fitmentAccurate: rating >= 3,
      qualityRating: Math.min(5, Math.max(1, rating + randomInt(rng, -1, 1))),
      valueRating: Math.min(5, Math.max(1, rating + randomInt(rng, -1, 1))),
      comment,
      images: [],
      sellerReply:
        status === 'published' && weightedBool(rng, 0.3)
          ? { comment: pick(rng, SELLER_REPLIES), repliedAt: createdAt + 86_400_000 }
          : undefined,
      verifiedPurchase: true,
      status,
      moderationStatus: rating <= 2 && weightedBool(rng, 0.3) ? 'flagged' : 'clean',
      createdAt,
      updatedAt: createdAt,
    })
    reviews.push(review)
  }

  await seedCollection(db.collection('reviews'), reviews)
  console.log(`  reviews: ${reviews.length}`)
}
