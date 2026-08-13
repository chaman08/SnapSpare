import type { SubOrder } from '@snapspare/shared'
import { subOrderConverter } from '@snapspare/shared'
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

/** Live-subscribes to every subOrder the buyer has ever had — used by OrdersPage to search by part name (the parent `orders` doc has no line items of its own) and to know which orders are reorderable. */
export function useBuyerSubOrders(buyerId: string | undefined): SubOrder[] {
  const [subOrders, setSubOrders] = useState<SubOrder[]>([])

  useEffect(() => {
    if (!buyerId) {
      setSubOrders([])
      return
    }
    const q = query(
      collection(db, 'subOrders').withConverter(clientConverter(subOrderConverter)),
      where('buyerId', '==', buyerId),
      orderBy('createdAt', 'desc'),
    )
    return onSnapshot(q, (snapshot) => setSubOrders(snapshot.docs.map((d) => d.data())), () => setSubOrders([]))
  }, [buyerId])

  return subOrders
}
