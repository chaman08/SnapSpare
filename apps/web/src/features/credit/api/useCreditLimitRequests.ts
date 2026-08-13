import type { CreditLimitRequest } from '@snapspare/shared'
import { creditLimitRequestConverter } from '@snapspare/shared'
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

/** Admin-only: live-subscribes to pending Khata credit-limit requests awaiting approval. */
export function usePendingCreditLimitRequests(): { requests: CreditLimitRequest[]; loading: boolean } {
  const [requests, setRequests] = useState<CreditLimitRequest[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(
      collection(db, 'creditLimitRequests').withConverter(clientConverter(creditLimitRequestConverter)),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'asc'),
    )
    return onSnapshot(
      q,
      (snapshot) => {
        setRequests(snapshot.docs.map((d) => d.data()))
        setLoading(false)
      },
      () => setLoading(false),
    )
  }, [])

  return { requests, loading }
}
