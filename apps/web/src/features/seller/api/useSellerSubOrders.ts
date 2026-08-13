import type { SubOrder, SubOrderStatus } from '@snapspare/shared'
import { subOrderConverter } from '@snapspare/shared'
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

/** Live-subscribes to a seller's subOrders in any of `statuses` — one query per SellerOrdersPage tab, backed by the `subOrders(sellerId, status, createdAt)` composite index. */
export function useSellerSubOrders(
  sellerId: string | undefined,
  statuses: SubOrderStatus[],
): { subOrders: SubOrder[]; loading: boolean } {
  const [subOrders, setSubOrders] = useState<SubOrder[]>([])
  const [loading, setLoading] = useState(Boolean(sellerId))
  const statusesKey = statuses.join(',')

  useEffect(() => {
    if (!sellerId || statuses.length === 0) {
      setSubOrders([])
      setLoading(false)
      return
    }
    setLoading(true)
    const q = query(
      collection(db, 'subOrders').withConverter(clientConverter(subOrderConverter)),
      where('sellerId', '==', sellerId),
      where('status', 'in', statuses),
      orderBy('createdAt', 'desc'),
    )
    return onSnapshot(
      q,
      (snapshot) => {
        setSubOrders(snapshot.docs.map((d) => d.data()))
        setLoading(false)
      },
      () => setLoading(false),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps -- statuses is compared via statusesKey
  }, [sellerId, statusesKey])

  return { subOrders, loading }
}
