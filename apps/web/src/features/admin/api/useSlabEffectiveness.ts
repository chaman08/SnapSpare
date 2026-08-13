import { slabEffectivenessDailyConverter } from '@snapspare/shared'
import { useQuery } from '@tanstack/react-query'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'
import type { AnalyticsRangeDays } from '@/features/admin/api/useAnalyticsFunnel'

export interface SlabBucketResult {
  tierMinQtyApplied: number
  gmvPaise: number
  unitsSold: number
  gmvSharePercent: number
}

function dateStringsForRange(days: number): string[] {
  const out: string[] = []
  for (let i = 0; i < days; i += 1) {
    out.push(new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10))
  }
  return out
}

/** GMV-by-tier rollup (Phase 22 requirement 2's slab-effectiveness report) — merges rollupSlabEffectivenessDaily.ts's per-day docs across the selected range. */
export function useSlabEffectiveness(days: AnalyticsRangeDays) {
  return useQuery({
    queryKey: ['admin-slab-effectiveness', days],
    queryFn: async (): Promise<{ buckets: SlabBucketResult[]; totalGmvPaise: number }> => {
      const dates = dateStringsForRange(days)
      const minDate = dates[dates.length - 1]!
      const maxDate = dates[0]!

      const snapshot = await getDocs(
        query(
          collection(db, 'slabEffectivenessDaily').withConverter(clientConverter(slabEffectivenessDailyConverter)),
          where('date', '>=', minDate),
          where('date', '<=', maxDate),
        ),
      )

      const gmvByTier = new Map<number, { gmvPaise: number; unitsSold: number }>()
      let totalGmvPaise = 0
      for (const doc of snapshot.docs) {
        const data = doc.data()
        for (const bucket of data.buckets) {
          const existing = gmvByTier.get(bucket.tierMinQtyApplied) ?? { gmvPaise: 0, unitsSold: 0 }
          existing.gmvPaise += bucket.gmvPaise
          existing.unitsSold += bucket.unitsSold
          gmvByTier.set(bucket.tierMinQtyApplied, existing)
          totalGmvPaise += bucket.gmvPaise
        }
      }

      const buckets = Array.from(gmvByTier.entries())
        .map(([tierMinQtyApplied, agg]) => ({
          tierMinQtyApplied,
          ...agg,
          gmvSharePercent: totalGmvPaise === 0 ? 0 : Math.round((agg.gmvPaise / totalGmvPaise) * 1000) / 10,
        }))
        .sort((a, b) => a.tierMinQtyApplied - b.tierMinQtyApplied)

      return { buckets, totalGmvPaise }
    },
    staleTime: 5 * 60_000,
  })
}
