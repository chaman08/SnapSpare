import { cohortRetentionConverter, type BuyerType } from '@snapspare/shared'
import { useQuery } from '@tanstack/react-query'
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

const COHORTS_SHOWN = 12
export const RETENTION_MONTH_OFFSETS = [0, 1, 2, 3, 4, 5] as const

/** Monthly cohort-retention matrix (Phase 22 requirement 2), most recent 12 cohorts for one buyer type — see rollupCohortRetention.ts for how the underlying docs are computed. */
export function useCohortRetention(buyerType: BuyerType) {
  return useQuery({
    queryKey: ['admin-cohort-retention', buyerType],
    queryFn: async () => {
      const snapshot = await getDocs(
        query(
          collection(db, 'cohortRetention').withConverter(clientConverter(cohortRetentionConverter)),
          where('buyerType', '==', buyerType),
          orderBy('cohortMonth', 'desc'),
          limit(COHORTS_SHOWN),
        ),
      )
      return snapshot.docs.map((doc) => doc.data()).sort((a, b) => a.cohortMonth.localeCompare(b.cohortMonth))
    },
    staleTime: 5 * 60_000,
  })
}
