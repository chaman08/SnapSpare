import type { Order, SubOrder } from '@snapspare/shared'
import { orderConverter, subOrderConverter } from '@snapspare/shared'
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

interface UseOrderResult {
  order: Order | null
  subOrders: SubOrder[]
  loading: boolean
  error: Error | null
}

/** Live-subscribes to one order and its per-seller subOrders — used by both the post-checkout confirmation screen and the order detail page, so status updates (e.g. the webhook confirming payment moments after redirect) show up without a manual refresh. */
export function useOrder(orderId: string | undefined): UseOrderResult {
  const [order, setOrder] = useState<Order | null>(null)
  const [subOrders, setSubOrders] = useState<SubOrder[]>([])
  const [orderLoading, setOrderLoading] = useState(Boolean(orderId))
  const [subOrdersLoading, setSubOrdersLoading] = useState(Boolean(orderId))
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!orderId) {
      setOrder(null)
      setOrderLoading(false)
      return
    }
    setOrderLoading(true)
    return onSnapshot(
      doc(db, 'orders', orderId).withConverter(clientConverter(orderConverter)),
      (snapshot) => {
        setOrder(snapshot.exists() ? snapshot.data() : null)
        setOrderLoading(false)
      },
      (err) => {
        setError(err)
        setOrderLoading(false)
      },
    )
  }, [orderId])

  useEffect(() => {
    if (!orderId) {
      setSubOrders([])
      setSubOrdersLoading(false)
      return
    }
    setSubOrdersLoading(true)
    const q = query(
      collection(db, 'subOrders').withConverter(clientConverter(subOrderConverter)),
      where('orderId', '==', orderId),
    )
    return onSnapshot(
      q,
      (snapshot) => {
        setSubOrders(snapshot.docs.map((d) => d.data()))
        setSubOrdersLoading(false)
      },
      (err) => {
        setError(err)
        setSubOrdersLoading(false)
      },
    )
  }, [orderId])

  return { order, subOrders, loading: orderLoading || subOrdersLoading, error }
}
