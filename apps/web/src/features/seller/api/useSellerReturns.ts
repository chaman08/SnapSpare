import type { Return } from '@snapspare/shared'
import { returnConverter } from '@snapspare/shared'
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

/** Live-subscribes to every return request against this seller — backs the seller order queue's "Returns" tab. */
export function useSellerReturns(sellerId: string | undefined): { returns: Return[]; loading: boolean } {
  const [returns, setReturns] = useState<Return[]>([])
  const [loading, setLoading] = useState(Boolean(sellerId))

  useEffect(() => {
    if (!sellerId) {
      setReturns([])
      setLoading(false)
      return
    }
    setLoading(true)
    const q = query(
      collection(db, 'returns').withConverter(clientConverter(returnConverter)),
      where('sellerId', '==', sellerId),
      orderBy('requestedAt', 'desc'),
    )
    return onSnapshot(
      q,
      (snapshot) => {
        setReturns(snapshot.docs.map((d) => d.data()))
        setLoading(false)
      },
      () => setLoading(false),
    )
  }, [sellerId])

  return { returns, loading }
}
