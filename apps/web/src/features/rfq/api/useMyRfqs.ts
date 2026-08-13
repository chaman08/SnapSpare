import type { Rfq } from '@snapspare/shared'
import { rfqConverter } from '@snapspare/shared'
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

/** Live-subscribes to the signed-in buyer's own RFQs, newest first — powers /rfq's list. */
export function useMyRfqs(userId: string | undefined) {
  const [rfqs, setRfqs] = useState<Rfq[]>([])
  const [loading, setLoading] = useState(Boolean(userId))
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!userId) {
      setRfqs([])
      setLoading(false)
      return
    }
    setLoading(true)
    const q = query(
      collection(db, 'rfqs').withConverter(clientConverter(rfqConverter)),
      where('buyerId', '==', userId),
      orderBy('createdAt', 'desc'),
    )
    return onSnapshot(
      q,
      (snapshot) => {
        setRfqs(snapshot.docs.map((d) => d.data()))
        setLoading(false)
        setError(null)
      },
      (err) => {
        setError(err)
        setLoading(false)
      },
    )
  }, [userId])

  return { rfqs, loading, error }
}
