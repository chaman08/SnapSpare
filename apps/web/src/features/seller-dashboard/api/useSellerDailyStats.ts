import type { SellerDailyStats } from '@snapspare/shared'
import { sellerDailyStatsConverter } from '@snapspare/shared'
import { useQuery } from '@tanstack/react-query'
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

export type DashboardRangeDays = 7 | 30 | 90

function isoDateDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

/**
 * Backing data for the revenue chart, top-selling parts, SLA scorecard and
 * conversion widgets (requirement 6) — all four derive from the same daily
 * pre-aggregation (rollupSellerDailyStats.ts), so one range fetch feeds all
 * of them rather than each widget re-scanning `subOrders` itself.
 */
export function useSellerDailyStats(sellerId: string | undefined, rangeDays: DashboardRangeDays) {
  return useQuery({
    queryKey: ['seller-daily-stats', sellerId, rangeDays],
    queryFn: async (): Promise<SellerDailyStats[]> => {
      if (!sellerId) return []
      const startDate = isoDateDaysAgo(rangeDays)
      const snapshot = await getDocs(
        query(
          collection(db, 'sellerDailyStats').withConverter(clientConverter(sellerDailyStatsConverter)),
          where('sellerId', '==', sellerId),
          where('date', '>=', startDate),
          orderBy('date', 'asc'),
        ),
      )
      return snapshot.docs.map((d) => d.data())
    },
    enabled: Boolean(sellerId),
    staleTime: 60_000,
  })
}
