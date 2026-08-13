import type {
  AdminForceOrderActionRequest,
  AdminForceOrderActionResult,
  GetPaymentReconciliationReportRequest,
  GetPaymentReconciliationReportResult,
  Order,
  SubOrder,
} from '@snapspare/shared'
import { orderConverter, subOrderConverter } from '@snapspare/shared'
import { useQuery } from '@tanstack/react-query'
import { httpsCallable } from 'firebase/functions'
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore'
import { useState } from 'react'
import { db, functions } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

export function useOrderLookup() {
  const [order, setOrder] = useState<Order | null | undefined>(undefined)
  const [subOrders, setSubOrders] = useState<SubOrder[]>([])
  const [loading, setLoading] = useState(false)

  async function lookup(orderId: string) {
    setLoading(true)
    try {
      const snapshot = await getDoc(doc(db, 'orders', orderId.trim()).withConverter(clientConverter(orderConverter)))
      if (!snapshot.exists()) {
        setOrder(null)
        setSubOrders([])
        return
      }
      const found = snapshot.data()
      setOrder(found)
      const subOrderSnapshot = await getDocs(
        query(collection(db, 'subOrders').withConverter(clientConverter(subOrderConverter)), where('orderId', '==', found.id)),
      )
      setSubOrders(subOrderSnapshot.docs.map((d) => d.data()))
    } finally {
      setLoading(false)
    }
  }

  return { order, subOrders, loading, lookup }
}

const adminForceOrderActionCallable = httpsCallable<AdminForceOrderActionRequest, AdminForceOrderActionResult>(
  functions,
  'adminForceOrderAction',
)

export async function adminForceOrderAction(request: AdminForceOrderActionRequest): Promise<AdminForceOrderActionResult> {
  const result = await adminForceOrderActionCallable(request)
  return result.data
}

const getPaymentReconciliationReportCallable = httpsCallable<
  GetPaymentReconciliationReportRequest,
  GetPaymentReconciliationReportResult
>(functions, 'getPaymentReconciliationReport')

export function usePaymentReconciliationReport(lookbackDays: number) {
  return useQuery({
    queryKey: ['admin-payment-reconciliation', lookbackDays],
    queryFn: async () => {
      const result = await getPaymentReconciliationReportCallable({ lookbackDays })
      return result.data.rows
    },
    staleTime: 30_000,
  })
}
