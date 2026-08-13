import { bayesianAverage, findContactInfo, findProfanity, looksLikePII, reviewSchema } from '@snapspare/shared'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import { onDocumentWritten } from 'firebase-functions/v2/firestore'

const RATING_PRIOR_MEAN = 3.8
const RATING_PRIOR_WEIGHT = 15

interface RatingAggregate {
  ratingAvg: number
  ratingCount: number
  ratingBayesian: number
}

function emptyAggregate(): RatingAggregate {
  return { ratingAvg: 0, ratingCount: 0, ratingBayesian: bayesianAverage({ sum: 0, count: 0, priorMean: RATING_PRIOR_MEAN, priorWeight: RATING_PRIOR_WEIGHT }) }
}

async function aggregateRatings(db: Firestore, field: 'listingId' | 'partId' | 'sellerId', value: string): Promise<RatingAggregate> {
  const snapshot = await db
    .collection('reviews')
    .where(field, '==', value)
    .where('status', '==', 'published')
    .select('rating')
    .get()

  if (snapshot.empty) return emptyAggregate()

  let sum = 0
  for (const doc of snapshot.docs) sum += (doc.data().rating as number) ?? 0
  const count = snapshot.size

  return {
    ratingAvg: sum / count,
    ratingCount: count,
    ratingBayesian: bayesianAverage({ sum, count, priorMean: RATING_PRIOR_MEAN, priorWeight: RATING_PRIOR_WEIGHT }),
  }
}

async function aggregateFitment(db: Firestore, listingId: string): Promise<{ fitmentAccurateCount: number; fitmentInaccurateCount: number }> {
  const snapshot = await db
    .collection('reviews')
    .where('listingId', '==', listingId)
    .where('status', '==', 'published')
    .select('fitmentAccurate')
    .get()

  let accurate = 0
  let inaccurate = 0
  for (const doc of snapshot.docs) {
    if (doc.data().fitmentAccurate === true) accurate += 1
    else if (doc.data().fitmentAccurate === false) inaccurate += 1
  }
  return { fitmentAccurateCount: accurate, fitmentInaccurateCount: inaccurate }
}

/**
 * Recomputes denormalized rating aggregates on the listing, catalog part and
 * seller (Bayesian-averaged so a single 5-star review can't outrank a
 * well-evidenced lower-but-more-reviewed score — see
 * packages/shared/src/trust/bayesian.ts). A manual scan (like
 * rollupSellerDailyStats.ts) rather than an Admin SDK aggregate query, so
 * this doesn't depend on a specific firebase-admin version. Writing
 * `listings/{id}` naturally re-fires the existing onListingWrite Typesense
 * sync trigger, so search stays in sync for free.
 */
async function recomputeAggregates(db: Firestore, listingId: string, partId: string, sellerId: string): Promise<void> {
  const [listingAgg, partAgg, sellerAgg, fitmentAgg] = await Promise.all([
    aggregateRatings(db, 'listingId', listingId),
    aggregateRatings(db, 'partId', partId),
    aggregateRatings(db, 'sellerId', sellerId),
    aggregateFitment(db, listingId),
  ])

  const now = Date.now()
  const batch = db.batch()
  batch.update(db.collection('listings').doc(listingId), { ...listingAgg, ...fitmentAgg, updatedAt: now })
  batch.update(db.collection('catalogParts').doc(partId), { ...partAgg, updatedAt: now })
  batch.update(db.collection('sellers').doc(sellerId), { ratingAvg: sellerAgg.ratingAvg, ratingCount: sellerAgg.ratingCount, ratingBayesian: sellerAgg.ratingBayesian, updatedAt: now })
  batch.update(db.collection('sellers').doc(sellerId).collection('settings').doc('general'), {
    ratingAvg: sellerAgg.ratingAvg,
    ratingCount: sellerAgg.ratingCount,
    ratingBayesian: sellerAgg.ratingBayesian,
  })
  await batch.commit().catch((error) => {
    // The seller settings doc may not exist for every seller shape variant — retry the two docs that matter most individually rather than losing the whole update.
    logger.warn('onReviewWrite: batch aggregate update failed, retrying listing/part/seller individually', { listingId, partId, sellerId, error })
    return Promise.all([
      db.collection('listings').doc(listingId).update({ ...listingAgg, ...fitmentAgg, updatedAt: now }),
      db.collection('catalogParts').doc(partId).update({ ...partAgg, updatedAt: now }),
      db.collection('sellers').doc(sellerId).update({ ratingAvg: sellerAgg.ratingAvg, ratingCount: sellerAgg.ratingCount, ratingBayesian: sellerAgg.ratingBayesian, updatedAt: now }),
    ])
  })
}

/**
 * Two responsibilities combined into one trigger to avoid two competing
 * writers on the same review doc (see design brief items 2 and 3):
 *
 * 1. On create, screens title+comment for contact info/profanity/PII
 *    (packages/shared/src/validators/messageContent.ts). Clean reviews
 *    auto-publish; flagged ones stay `pending` with `moderationStatus:
 *    'flagged'` for the admin queue. Edits to an already-published review
 *    are not re-screened — see moderateReview.ts for the admin's manual path
 *    if an edit needs hiding.
 * 2. Whenever a review is or was `published`, recomputes the listing/part/
 *    seller rating aggregates — covers publish, un-publish (admin reject),
 *    and an edit to a still-published review's rating/fitmentAccurate.
 */
export const onReviewWrite = onDocumentWritten({ document: 'reviews/{reviewId}', region: 'asia-south1' }, async (event) => {
  const before = event.data?.before.exists ? event.data.before.data() : undefined
  const after = event.data?.after.exists ? event.data.after.data() : undefined
  const db = getFirestore()

  if (!after) {
    // Deleted (admin-only). If it was published, its removal still changes the aggregates.
    if (before?.status === 'published' && before.listingId && before.partId && before.sellerId) {
      await recomputeAggregates(db, before.listingId, before.partId, before.sellerId)
    }
    return
  }

  const parsed = reviewSchema.safeParse({ id: event.params.reviewId, ...after })
  if (!parsed.success) {
    logger.error('onReviewWrite: review doc failed schema validation', { reviewId: event.params.reviewId, issues: parsed.error.issues })
    return
  }
  const review = parsed.data

  if (!before) {
    const text = [review.title, review.comment].filter(Boolean).join(' ')
    const flags: string[] = []
    if (findContactInfo(text)) flags.push('contact_info')
    if (findProfanity(text)) flags.push('profanity')
    if (looksLikePII(text)) flags.push('pii')

    if (flags.length > 0) {
      await event.data?.after.ref.update({ moderationStatus: 'flagged', moderationFlags: flags })
    } else {
      // Flips status to 'published', which re-triggers this function — that
      // second invocation is what actually runs recomputeAggregates.
      await event.data?.after.ref.update({ status: 'published', moderationStatus: 'clean' })
    }
    return
  }

  const wasPublished = before.status === 'published'
  const isPublished = review.status === 'published'
  if (!wasPublished && !isPublished) return

  await recomputeAggregates(db, review.listingId, review.partId, review.sellerId)
})
