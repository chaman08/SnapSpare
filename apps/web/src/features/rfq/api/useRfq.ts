import type { Rfq } from '@snapspare/shared'
import { rfqConverter } from '@snapspare/shared'
import { doc, onSnapshot } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

/** Live-subscribes to one RFQ — status changes as sellers quote/withdraw or the buyer accepts should reflect immediately while the buyer/seller is looking at it. */
export function useRfq(rfqId: string | undefined) {
  const [rfq, setRfq] = useState<Rfq | null | undefined>(undefined)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!rfqId) {
      setRfq(null)
      return
    }
    setRfq(undefined)
    return onSnapshot(
      doc(db, 'rfqs', rfqId).withConverter(clientConverter(rfqConverter)),
      (snapshot) => setRfq(snapshot.exists() ? snapshot.data() : null),
      (err) => setError(err),
    )
  }, [rfqId])

  return { rfq, loading: rfq === undefined, error }
}
