import type { SubOrder } from '@snapspare/shared'
import { subOrderConverter } from '@snapspare/shared'
import { useQuery } from '@tanstack/react-query'
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

/** The buyer's most recent delivered sub-orders — the "reorder rail" for returning buyers, one card per sub-order (mirrors OrdersPage's reorder button). */
export function useReorderRail(userId: string | undefined, maxItems: number) {
  return useQuery({
    queryKey: ['home-reorder-rail', userId, maxItems],
    queryFn: async (): Promise<SubOrder[]> => {
      if (!userId) return []
      const snapshot = await getDocs(
        query(
          collection(db, 'subOrders').withConverter(clientConverter(subOrderConverter)),
          where('buyerId', '==', userId),
          where('status', '==', 'delivered'),
          orderBy('createdAt', 'desc'),
          limit(maxItems),
        ),
      )
      return snapshot.docs.map((d) => d.data())
    },
    enabled: Boolean(userId),
    staleTime: 60_000,
  })
}
