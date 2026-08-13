import type { EwayBillTask } from '@snapspare/shared'
import { ewayBillTaskConverter } from '@snapspare/shared'
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

/** Live-subscribes to a seller's e-way-bill tasks (design brief item 6's seller-console to-do list) — same pattern as useSellerSubOrders.ts. */
export function useEwayBillTasks(sellerId: string | undefined): { tasks: EwayBillTask[]; loading: boolean } {
  const [tasks, setTasks] = useState<EwayBillTask[]>([])
  const [loading, setLoading] = useState(Boolean(sellerId))

  useEffect(() => {
    if (!sellerId) {
      setTasks([])
      setLoading(false)
      return
    }
    setLoading(true)
    const q = query(
      collection(db, 'ewayBillTasks').withConverter(clientConverter(ewayBillTaskConverter)),
      where('sellerId', '==', sellerId),
      orderBy('createdAt', 'desc'),
    )
    return onSnapshot(
      q,
      (snapshot) => {
        setTasks(snapshot.docs.map((d) => d.data()))
        setLoading(false)
      },
      () => setLoading(false),
    )
  }, [sellerId])

  return { tasks, loading }
}
