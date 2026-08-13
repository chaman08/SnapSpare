import { getFirestore } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { addMonths, istMonthStartMs, istMonthString } from '../util/istDate.js'

/**
 * Full-history-within-window recompute every run, not an incremental
 * update — simplest correct implementation for this phase, but it does mean
 * this function's cost grows with total order volume over the lookback
 * window, not just this month's new orders. Fine at current scale (a single
 * bounded range query once a month); if order volume grows enough to make
 * that Firestore read expensive, the natural next step is maintaining a
 * running per-buyer "first order month" field instead of re-deriving it here
 * — not built now, see the Phase 22 README note.
 */
const LOOKBACK_MONTHS = 24

function monthsBetween(fromMonth: string, toMonth: string): number {
  const [fy, fm] = fromMonth.split('-').map(Number)
  const [ty, tm] = toMonth.split('-').map(Number)
  return (ty! - fy!) * 12 + (tm! - fm!)
}

/**
 * Monthly cohort-retention matrix per buyer type (Phase 22 requirement 2).
 * A buyer's cohort is their first-ever order's month, tagged with the
 * buyerType captured on that first order (a buyer's segment can drift later,
 * but the cohort itself shouldn't move) — see schemas/analyticsFunnel.ts's
 * cohortRetentionSchema.
 */
export const rollupCohortRetention = onSchedule(
  { region: 'asia-south1', schedule: '1 of month 04:00', timeZone: 'Etc/UTC', timeoutSeconds: 540, memory: '1GiB' },
  async () => {
    const db = getFirestore()
    const nowMs = Date.now()
    const currentMonth = istMonthString(nowMs)
    const earliestMonth = addMonths(currentMonth, -LOOKBACK_MONTHS)
    const windowStartMs = istMonthStartMs(earliestMonth)

    const snapshot = await db.collection('orders').where('placedAt', '>=', windowStartMs).get()

    const ordersByBuyer = new Map<string, { buyerType: string; months: Set<string> }>()
    for (const doc of snapshot.docs) {
      const order = doc.data() as { buyerId: string; buyerType: string; placedAt: number }
      const month = istMonthString(order.placedAt)
      const existing = ordersByBuyer.get(order.buyerId)
      if (existing) {
        existing.months.add(month)
      } else {
        ordersByBuyer.set(order.buyerId, { buyerType: order.buyerType, months: new Set([month]) })
      }
    }

    interface CohortAgg {
      buyerType: string
      cohortMonth: string
      cohortSize: number
      retention: Map<number, number>
    }
    const cohorts = new Map<string, CohortAgg>()

    for (const { buyerType, months } of ordersByBuyer.values()) {
      const sortedMonths = Array.from(months).sort()
      const cohortMonth = sortedMonths[0]!
      const key = `${buyerType}__${cohortMonth}`
      let cohort = cohorts.get(key)
      if (!cohort) {
        cohort = { buyerType, cohortMonth, cohortSize: 0, retention: new Map() }
        cohorts.set(key, cohort)
      }
      cohort.cohortSize += 1
      for (const month of sortedMonths) {
        const offset = monthsBetween(cohortMonth, month)
        cohort.retention.set(offset, (cohort.retention.get(offset) ?? 0) + 1)
      }
    }

    const now = Date.now()
    const cohortList = Array.from(cohorts.values())
    const batches: CohortAgg[][] = []
    for (let i = 0; i < cohortList.length; i += 400) batches.push(cohortList.slice(i, i + 400))

    for (const batchCohorts of batches) {
      const batch = db.batch()
      for (const cohort of batchCohorts) {
        const id = `${cohort.buyerType}__${cohort.cohortMonth}`
        const retention: Record<string, number> = {}
        for (const [offset, count] of cohort.retention) retention[String(offset)] = count
        batch.set(db.collection('cohortRetention').doc(id), {
          buyerType: cohort.buyerType,
          cohortMonth: cohort.cohortMonth,
          cohortSize: cohort.cohortSize,
          retention,
          updatedAt: now,
        })
      }
      await batch.commit()
    }

    logger.info('rollupCohortRetention: done', { cohortCount: cohortList.length, buyersProcessed: ordersByBuyer.size })
  },
)
