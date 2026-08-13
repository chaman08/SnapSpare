import type { AdminDashboardMetrics, AdminDashboardMetricsRequest, Order } from '@snapspare/shared'
import { orderConverter } from '@snapspare/shared'
import { useQuery } from '@tanstack/react-query'
import { httpsCallable } from 'firebase/functions'
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db, functions } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

const getAdminDashboardMetricsCallable = httpsCallable<AdminDashboardMetricsRequest, AdminDashboardMetrics>(
  functions,
  'getAdminDashboardMetrics',
)

export type DashboardPeriodDays = 7 | 30 | 90

export function useAdminDashboardMetrics(periodDays: DashboardPeriodDays) {
  return useQuery({
    queryKey: ['admin-dashboard-metrics', periodDays],
    queryFn: async () => {
      const result = await getAdminDashboardMetricsCallable({ periodDays })
      return result.data
    },
    staleTime: 60_000,
  })
}

/** Live feed of the most recently placed orders, for the dashboard's "new orders" panel. */
export function useLiveNewOrders(count = 15) {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(
      collection(db, 'orders').withConverter(clientConverter(orderConverter)),
      orderBy('placedAt', 'desc'),
      limit(count),
    )
    return onSnapshot(q, (snapshot) => {
      setOrders(snapshot.docs.map((d) => d.data()))
      setLoading(false)
    })
  }, [count])

  return { orders, loading }
}
