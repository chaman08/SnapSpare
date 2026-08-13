import { getFirestore } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { istDayRangeMs, istYesterdayString } from '../util/istDate.js'

interface SubOrderItemRow {
  tierMinQtyApplied: number
  qty: number
  lineTotalPaise: number
}

/**
 * GMV-by-tier rollup (Phase 22 requirement 2 — "a slab-effectiveness report
 * showing how much GMV comes from each tier, to tune the ladders"). Reads
 * straight from `subOrders` (the authoritative money data — every line item
 * already records `tierMinQtyApplied` at order time, see
 * checkout/createOrder.ts's toSubOrderItem) rather than the analytics event
 * stream, so this report is exact, not sampled. Excludes cancelled/rejected
 * subOrders — a cancelled line never became real GMV. See
 * schemas/analyticsFunnel.ts's slabEffectivenessBucketSchema doc comment for
 * why buckets are keyed by raw `tierMinQtyApplied` rather than each
 * listing's ordinal tier position.
 */
export const rollupSlabEffectivenessDaily = onSchedule(
  { region: 'asia-south1', schedule: 'every day 01:30', timeZone: 'Etc/UTC', timeoutSeconds: 300, memory: '256MiB' },
  async () => {
    const db = getFirestore()
    const date = istYesterdayString()
    const { startMs, endMs } = istDayRangeMs(date)

    const snapshot = await db
      .collection('subOrders')
      .where('createdAt', '>=', startMs)
      .where('createdAt', '<', endMs)
      .get()

    const bucketByTier = new Map<number, { gmvPaise: number; unitsSold: number; lineCount: number }>()
    let totalGmvPaise = 0

    for (const doc of snapshot.docs) {
      const subOrder = doc.data() as { status: string; items: SubOrderItemRow[] }
      if (subOrder.status === 'cancelled' || subOrder.status === 'rejected') continue

      for (const item of subOrder.items) {
        const bucket = bucketByTier.get(item.tierMinQtyApplied) ?? { gmvPaise: 0, unitsSold: 0, lineCount: 0 }
        bucket.gmvPaise += item.lineTotalPaise
        bucket.unitsSold += item.qty
        bucket.lineCount += 1
        bucketByTier.set(item.tierMinQtyApplied, bucket)
        totalGmvPaise += item.lineTotalPaise
      }
    }

    const buckets = Array.from(bucketByTier.entries())
      .map(([tierMinQtyApplied, agg]) => ({ tierMinQtyApplied, ...agg }))
      .sort((a, b) => a.tierMinQtyApplied - b.tierMinQtyApplied)

    await db
      .collection('slabEffectivenessDaily')
      .doc(date)
      .set({ date, buckets, totalGmvPaise, updatedAt: Date.now() })

    logger.info('rollupSlabEffectivenessDaily: done', { date, bucketCount: buckets.length, totalGmvPaise })
  },
)
