import type { Rfq, RfqQuote } from '@snapspare/shared'
import { rfqConverter, rfqQuoteConverter } from '@snapspare/shared'
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

/** Live-subscribes to RFQs routed to this seller (matchSellersForRfq's routedSellerIds) — the seller's RFQ inbox at /seller/rfqs. */
export function useSellerRfqInbox(sellerId: string | undefined) {
  const [rfqs, setRfqs] = useState<Rfq[]>([])
  const [loading, setLoading] = useState(Boolean(sellerId))

  useEffect(() => {
    if (!sellerId) {
      setRfqs([])
      setLoading(false)
      return
    }
    setLoading(true)
    const q = query(
      collection(db, 'rfqs').withConverter(clientConverter(rfqConverter)),
      where('routedSellerIds', 'array-contains', sellerId),
      orderBy('createdAt', 'desc'),
    )
    return onSnapshot(q, (snapshot) => {
      setRfqs(snapshot.docs.map((d) => d.data()))
      setLoading(false)
    })
  }, [sellerId])

  return { rfqs, loading }
}

/** Live-subscribes to this seller's own quotes across every RFQ, newest first — used to show "you already quoted" state in the inbox and a per-RFQ quote-status badge. */
export function useSellerQuotes(sellerId: string | undefined) {
  const [quotes, setQuotes] = useState<RfqQuote[]>([])
  const [loading, setLoading] = useState(Boolean(sellerId))

  useEffect(() => {
    if (!sellerId) {
      setQuotes([])
      setLoading(false)
      return
    }
    setLoading(true)
    const q = query(
      collection(db, 'rfqQuotes').withConverter(clientConverter(rfqQuoteConverter)),
      where('sellerId', '==', sellerId),
      orderBy('createdAt', 'desc'),
    )
    return onSnapshot(q, (snapshot) => {
      setQuotes(snapshot.docs.map((d) => d.data()))
      setLoading(false)
    })
  }, [sellerId])

  return { quotes, loading }
}
