import type { Order } from '@snapspare/shared'
import { orderConverter } from '@snapspare/shared'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

/**
 * Live-subscribes to the signed-in buyer's `pending_payment` orders — drives
 * the persistent "resume payment" banner. Two equality filters (`buyerId`,
 * `status`) don't need a composite index, so this deliberately skips
 * `orderBy` and sorts the (always tiny) result client-side instead.
 */
export function usePendingOrders(userId: string | undefined): { pendingOrders: Order[]; loading: boolean } {
  const [pendingOrders, setPendingOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(Boolean(userId))

  useEffect(() => {
    if (!userId) {
      setPendingOrders([])
      setLoading(false)
      return
    }
    setLoading(true)
    const q = query(
      collection(db, 'orders').withConverter(clientConverter(orderConverter)),
      where('buyerId', '==', userId),
      where('status', '==', 'pending_payment'),
    )
    return onSnapshot(
      q,
      (snapshot) => {
        const orders = snapshot.docs.map((d) => d.data()).sort((a, b) => b.createdAt - a.createdAt)
        setPendingOrders(orders)
        setLoading(false)
      },
      () => setLoading(false),
    )
  }, [userId])

  return { pendingOrders, loading }
}
