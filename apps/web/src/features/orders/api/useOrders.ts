import type { Order } from '@snapspare/shared'
import { orderConverter } from '@snapspare/shared'
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

interface UseOrdersResult {
  orders: Order[]
  loading: boolean
  error: Error | null
}

/** Live-subscribes to the signed-in buyer's order history, newest first — powers OrdersPage's list. */
export function useOrders(userId: string | undefined): UseOrdersResult {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(Boolean(userId))
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!userId) {
      setOrders([])
      setLoading(false)
      return
    }
    setLoading(true)
    const q = query(
      collection(db, 'orders').withConverter(clientConverter(orderConverter)),
      where('buyerId', '==', userId),
      orderBy('createdAt', 'desc'),
    )
    return onSnapshot(
      q,
      (snapshot) => {
        setOrders(snapshot.docs.map((d) => d.data()))
        setLoading(false)
        setError(null)
      },
      (err) => {
        setError(err)
        setLoading(false)
      },
    )
  }, [userId])

  return { orders, loading, error }
}
