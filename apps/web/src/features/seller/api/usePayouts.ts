import type { Payout } from '@snapspare/shared'
import { payoutConverter } from '@snapspare/shared'
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

/** Live-subscribes to a seller's payout history, newest first (design brief item 6: "upcoming payout with a date, payout history"). The most recent `processing`/`pending` entry — if any — is the "upcoming" one; everything else is history. */
export function usePayouts(sellerId: string | undefined): { payouts: Payout[]; loading: boolean } {
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [loading, setLoading] = useState(Boolean(sellerId))

  useEffect(() => {
    if (!sellerId) {
      setPayouts([])
      setLoading(false)
      return
    }
    setLoading(true)
    const q = query(
      collection(db, 'payouts').withConverter(clientConverter(payoutConverter)),
      where('sellerId', '==', sellerId),
      orderBy('periodTo', 'desc'),
    )
    return onSnapshot(
      q,
      (snapshot) => {
        setPayouts(snapshot.docs.map((d) => d.data()))
        setLoading(false)
      },
      () => setLoading(false),
    )
  }, [sellerId])

  return { payouts, loading }
}
