import { sellerDailyStatsSchema, sellerSchema } from '@snapspare/shared'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import { onSchedule } from 'firebase-functions/v2/scheduler'

const DAY_MS = 24 * 60 * 60_000
const TRUST_SCORE_WINDOW_DAYS = 90
const BATCH_LIMIT = 400

// Weights are hard-coded constants, not admin-configurable in this phase —
// see the plan's "deliberately left out" note. Keep them named and summing
// to 1 so `score` stays comparable across a weight retune.
const WEIGHTS = {
  rating: 0.3,
  sla: 0.25,
  cancellation: 0.15,
  return: 0.15,
  spurious: 0.1,
  tenure: 0.05,
} as const

const MIN_ORDERS_FOR_SCORING = 5
const MIN_TENURE_DAYS_FOR_SCORING = 30
const TENURE_FULL_CREDIT_MONTHS = 12
const TRUSTED_THRESHOLD = 60
const TOP_RATED_THRESHOLD = 85
const TOP_RATED_MIN_RATING_COUNT = 20

function isoDateDaysAgo(days: number): string {
  return new Date(Date.now() - days * DAY_MS).toISOString().slice(0, 10)
}

function clamp0to100(value: number): number {
  return Math.max(0, Math.min(100, value))
}

interface TrailingTotals {
  ordersCount: number
  slaAcceptedOnTime: number
  slaAcceptedLate: number
  slaPackedOnTime: number
  slaPackedLate: number
  cancelledCount: number
  returnsCount: number
}

async function trailingTotals(db: Firestore, sellerId: string): Promise<TrailingTotals> {
  const startDate = isoDateDaysAgo(TRUST_SCORE_WINDOW_DAYS)
  const snapshot = await db
    .collection('sellerDailyStats')
    .where('sellerId', '==', sellerId)
    .where('date', '>=', startDate)
    .get()

  const totals: TrailingTotals = {
    ordersCount: 0,
    slaAcceptedOnTime: 0,
    slaAcceptedLate: 0,
    slaPackedOnTime: 0,
    slaPackedLate: 0,
    cancelledCount: 0,
    returnsCount: 0,
  }

  for (const doc of snapshot.docs) {
    const parsed = sellerDailyStatsSchema.safeParse({ id: doc.id, ...doc.data() })
    if (!parsed.success) continue
    const day = parsed.data
    totals.ordersCount += day.ordersCount
    totals.slaAcceptedOnTime += day.slaAcceptedOnTime
    totals.slaAcceptedLate += day.slaAcceptedLate
    totals.slaPackedOnTime += day.slaPackedOnTime
    totals.slaPackedLate += day.slaPackedLate
    totals.cancelledCount += day.cancelledCount
    totals.returnsCount += day.returnsCount
  }
  return totals
}

/**
 * Daily seller trust score (design brief item 5) — composes rating, dispatch
 * SLA, cancellation rate, return rate, spurious-part reports and tenure into
 * one 0-100 score and a buyer-facing tier (New/Trusted/Top-rated). Runs
 * after rollupSellerDailyStats.ts so the trailing-window totals it reads are
 * fresh. A seller with too little history (few orders, short tenure) is
 * pinned to 'new' regardless of the raw score — a handful of good/bad
 * outcomes shouldn't swing a tier with a wide public difference in buyer
 * trust.
 */
export const computeSellerTrustScores = onSchedule(
  { region: 'asia-south1', schedule: 'every day 03:00', timeZone: 'Etc/UTC', timeoutSeconds: 300, memory: '512MiB' },
  async () => {
    const db = getFirestore()
    const now = Date.now()

    const sellersSnapshot = await db.collection('sellers').where('status', '==', 'active').get()
    const sellerDocs = sellersSnapshot.docs
    let processed = 0

    for (let i = 0; i < sellerDocs.length; i += BATCH_LIMIT) {
      const chunk = sellerDocs.slice(i, i + BATCH_LIMIT)
      const batch = db.batch()

      await Promise.all(
        chunk.map(async (doc) => {
          const parsed = sellerSchema.safeParse({ id: doc.id, ...doc.data() })
          if (!parsed.success) return
          const seller = parsed.data

          const totals = await trailingTotals(db, seller.id)

          const ratingComponent = clamp0to100((seller.ratingBayesian / 5) * 100)

          const slaAcceptTotal = totals.slaAcceptedOnTime + totals.slaAcceptedLate
          const slaPackTotal = totals.slaPackedOnTime + totals.slaPackedLate
          const acceptRate = slaAcceptTotal > 0 ? totals.slaAcceptedOnTime / slaAcceptTotal : 1
          const packRate = slaPackTotal > 0 ? totals.slaPackedOnTime / slaPackTotal : 1
          const slaComponent = clamp0to100(((acceptRate + packRate) / 2) * 100)

          const cancellationRate = totals.ordersCount > 0 ? totals.cancelledCount / totals.ordersCount : 0
          const cancellationComponent = clamp0to100((1 - cancellationRate) * 100)

          const returnRate = totals.ordersCount > 0 ? totals.returnsCount / totals.ordersCount : 0
          const returnComponent = clamp0to100((1 - returnRate) * 100)

          const spuriousPenalty = seller.warningsCount * 10 + (seller.spuriousReportsCount - seller.warningsCount) * 20
          const spuriousComponent = clamp0to100(100 - spuriousPenalty)

          const tenureDays = seller.onboardedAt !== undefined ? (now - seller.onboardedAt) / DAY_MS : 0
          const tenureMonths = tenureDays / 30
          const tenureComponent = clamp0to100((tenureMonths / TENURE_FULL_CREDIT_MONTHS) * 100)

          const score = clamp0to100(
            ratingComponent * WEIGHTS.rating +
              slaComponent * WEIGHTS.sla +
              cancellationComponent * WEIGHTS.cancellation +
              returnComponent * WEIGHTS.return +
              spuriousComponent * WEIGHTS.spurious +
              tenureComponent * WEIGHTS.tenure,
          )

          const hasEnoughData = totals.ordersCount >= MIN_ORDERS_FOR_SCORING && tenureDays >= MIN_TENURE_DAYS_FOR_SCORING
          let tier: 'new' | 'trusted' | 'top_rated' = 'new'
          if (hasEnoughData) {
            if (score >= TOP_RATED_THRESHOLD && seller.ratingCount >= TOP_RATED_MIN_RATING_COUNT && seller.spuriousReportsCount === 0) {
              tier = 'top_rated'
            } else if (score >= TRUSTED_THRESHOLD) {
              tier = 'trusted'
            }
          }

          batch.update(doc.ref, {
            trustScore: {
              score,
              tier,
              breakdown: { ratingComponent, slaComponent, cancellationComponent, returnComponent, spuriousComponent, tenureComponent },
              computedAt: now,
            },
            updatedAt: now,
          })
          // Only the tier is mirrored onto the public settings/general doc —
          // see sellerSettingsSchema's doc comment: the full breakdown is
          // seller-private, buyers only ever see the tier badge.
          batch.update(doc.ref.collection('settings').doc('general'), { trustTier: tier })
          processed += 1
        }),
      )

      await batch.commit()
    }

    logger.info('computeSellerTrustScores: scored', { sellersScored: processed })
  },
)
