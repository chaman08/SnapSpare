import { analyticsFunnelDailyConverter, FUNNEL_EVENT_NAMES, type FunnelSegment, type FunnelStep } from '@snapspare/shared'
import { useQuery } from '@tanstack/react-query'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

export type AnalyticsRangeDays = 7 | 30 | 90

export interface FunnelStepResult {
  step: FunnelStep
  count: number
  /** % lost vs. the previous step — null for the first step (nothing to compare against). */
  dropOffPercent: number | null
}

function dateStringsForRange(days: number): string[] {
  const out: string[] = []
  for (let i = 0; i < days; i += 1) {
    out.push(new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10))
  }
  return out
}

/**
 * Sums each funnel step's daily counter docs across the selected range for
 * one segment (Phase 22 requirement 2's funnel dashboard — search → product
 * → cart → checkout → payment → purchase, with a drop-off % between each
 * consecutive step). Reads `analyticsFunnelDaily` directly (admin-only via
 * firestore.rules) rather than through a callable — this is a read-only
 * aggregation over a handful of small precomputed docs, not a live
 * cross-collection join, so there's nothing a callable would add here.
 */
export function useAnalyticsFunnel(days: AnalyticsRangeDays, segment: FunnelSegment) {
  return useQuery({
    queryKey: ['admin-analytics-funnel', days, segment],
    queryFn: async (): Promise<FunnelStepResult[]> => {
      const dates = dateStringsForRange(days)
      const minDate = dates[dates.length - 1]!
      const maxDate = dates[0]!

      const snapshot = await getDocs(
        query(
          collection(db, 'analyticsFunnelDaily').withConverter(clientConverter(analyticsFunnelDailyConverter)),
          where('segment', '==', segment),
          where('date', '>=', minDate),
          where('date', '<=', maxDate),
        ),
      )

      const totals = new Map<FunnelStep, number>()
      for (const doc of snapshot.docs) {
        const data = doc.data()
        for (const [step, count] of Object.entries(data.steps)) {
          totals.set(step as FunnelStep, (totals.get(step as FunnelStep) ?? 0) + count)
        }
      }

      return FUNNEL_EVENT_NAMES.map((step, index) => {
        const count = totals.get(step) ?? 0
        const prevStep = index === 0 ? undefined : FUNNEL_EVENT_NAMES[index - 1]
        const prevCount = prevStep ? (totals.get(prevStep) ?? 0) : undefined
        const dropOffPercent =
          prevCount === undefined || prevCount === 0 ? null : Math.round((1 - count / prevCount) * 1000) / 10
        return { step, count, dropOffPercent }
      })
    },
    staleTime: 5 * 60_000,
  })
}
