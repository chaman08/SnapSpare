import type { Dispute } from '@snapspare/shared'
import { disputeConverter } from '@snapspare/shared'
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

/** Live-subscribes to every dispute against this seller — backs SellerDisputesPage. */
export function useSellerDisputes(sellerId: string | undefined): { disputes: Dispute[]; loading: boolean } {
  const [disputes, setDisputes] = useState<Dispute[]>([])
  const [loading, setLoading] = useState(Boolean(sellerId))

  useEffect(() => {
    if (!sellerId) {
      setDisputes([])
      setLoading(false)
      return
    }
    setLoading(true)
    const q = query(
      collection(db, 'disputes').withConverter(clientConverter(disputeConverter)),
      where('sellerId', '==', sellerId),
      orderBy('createdAt', 'desc'),
    )
    return onSnapshot(
      q,
      (snapshot) => {
        setDisputes(snapshot.docs.map((d) => d.data()))
        setLoading(false)
      },
      () => setLoading(false),
    )
  }, [sellerId])

  return { disputes, loading }
}
