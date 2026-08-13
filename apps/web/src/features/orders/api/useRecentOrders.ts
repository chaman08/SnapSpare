import type { SubOrder } from '@snapspare/shared'
import { subOrderConverter } from '@snapspare/shared'
import { useQuery } from '@tanstack/react-query'
import { collection, limit, orderBy, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

const RECENT_ORDERS_LIMIT = 3

/** A buyer's most recent sub-orders, newest first — backs the empty cart's "reorder" shelf (design spec item 9). Best-effort: callers treat a load failure the same as "no recent orders" rather than surfacing a retry, since it's one panel inside a larger empty state that already has a guaranteed next action. */
export function useRecentOrders(buyerId: string | undefined) {
  return useQuery({
    queryKey: ['recent-orders', buyerId],
    queryFn: async (): Promise<SubOrder[]> => {
      if (!buyerId) return []
      const q = query(
        collection(db, 'subOrders').withConverter(clientConverter(subOrderConverter)),
        where('buyerId', '==', buyerId),
        orderBy('createdAt', 'desc'),
        limit(RECENT_ORDERS_LIMIT),
      )
      const snapshot = await getDocs(q)
      return snapshot.docs.map((doc) => doc.data())
    },
    enabled: Boolean(buyerId),
    staleTime: 60_000,
    retry: false,
  })
}
