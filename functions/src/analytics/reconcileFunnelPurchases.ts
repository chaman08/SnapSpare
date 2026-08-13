import { getFirestore } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { istDayRangeMs, istYesterdayString } from '../util/istDate.js'

/**
 * Overwrites yesterday's `purchase` funnel-step count with the authoritative
 * number derived from the `orders` collection, per buyer-type segment plus
 * an 'all' total — client purchase beacons (logFunnelEvent, fired from the
 * checkout success screen) can be lost to a closed tab, a flaky network, or
 * an ad-blocker, and this is the one funnel step with money riding on
 * getting it right. Every other step stays beacon-only — "how many people
 * viewed a product" has no authoritative backend equivalent to reconcile
 * against, this one does.
 */
export const reconcileFunnelPurchases = onSchedule(
  { region: 'asia-south1', schedule: 'every day 00:30', timeZone: 'Etc/UTC', timeoutSeconds: 300, memory: '256MiB' },
  async () => {
    const db = getFirestore()
    const date = istYesterdayString()
    const { startMs, endMs } = istDayRangeMs(date)

    const snapshot = await db.collection('orders').where('placedAt', '>=', startMs).where('placedAt', '<', endMs).get()

    const countsBySegment = new Map<string, number>()
    countsBySegment.set('all', snapshot.size)
    for (const doc of snapshot.docs) {
      const buyerType = (doc.data() as { buyerType?: string }).buyerType ?? 'retail'
      countsBySegment.set(buyerType, (countsBySegment.get(buyerType) ?? 0) + 1)
    }

    const now = Date.now()
    const batch = db.batch()
    for (const [segment, count] of countsBySegment) {
      const ref = db.collection('analyticsFunnelDaily').doc(`${date}__${segment}`)
      batch.set(ref, { date, segment, updatedAt: now, steps: { purchase: count } }, { merge: true })
    }
    await batch.commit()

    logger.info('reconcileFunnelPurchases: done', { date, totalOrders: snapshot.size })
  },
)
