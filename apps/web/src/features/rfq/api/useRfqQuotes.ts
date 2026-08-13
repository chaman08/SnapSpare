import type { RfqQuote } from '@snapspare/shared'
import { rfqQuoteConverter } from '@snapspare/shared'
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

/** Live-subscribes to every quote on one RFQ, newest first — the buyer's comparison view and the admin detail panel both need every quote regardless of status (so a withdrawn/rejected one still shows, greyed out). */
export function useRfqQuotes(rfqId: string | undefined) {
  const [quotes, setQuotes] = useState<RfqQuote[]>([])
  const [loading, setLoading] = useState(Boolean(rfqId))

  useEffect(() => {
    if (!rfqId) {
      setQuotes([])
      setLoading(false)
      return
    }
    setLoading(true)
    const q = query(
      collection(db, 'rfqQuotes').withConverter(clientConverter(rfqQuoteConverter)),
      where('rfqId', '==', rfqId),
      orderBy('createdAt', 'desc'),
    )
    return onSnapshot(q, (snapshot) => {
      setQuotes(snapshot.docs.map((d) => d.data()))
      setLoading(false)
    })
  }, [rfqId])

  return { quotes, loading }
}
