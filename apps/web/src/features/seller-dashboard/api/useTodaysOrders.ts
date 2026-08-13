import type { SubOrder } from '@snapspare/shared'
import { subOrderConverter } from '@snapspare/shared'
import { useQuery } from '@tanstack/react-query'
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

function startOfTodayUtcMs(): number {
  const now = new Date()
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
}

/** Requirement 6's "today's orders" widget — every subOrder placed since UTC midnight, any status. */
export function useTodaysOrders(sellerId: string | undefined) {
  return useQuery({
    queryKey: ['seller-todays-orders', sellerId],
    queryFn: async (): Promise<SubOrder[]> => {
      if (!sellerId) return []
      const snapshot = await getDocs(
        query(
          collection(db, 'subOrders').withConverter(clientConverter(subOrderConverter)),
          where('sellerId', '==', sellerId),
          where('createdAt', '>=', startOfTodayUtcMs()),
          orderBy('createdAt', 'desc'),
        ),
      )
      return snapshot.docs.map((d) => d.data())
    },
    enabled: Boolean(sellerId),
    staleTime: 30_000,
  })
}
