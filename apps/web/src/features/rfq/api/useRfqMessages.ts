import type { RfqMessage } from '@snapspare/shared'
import { rfqMessageConverter } from '@snapspare/shared'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

/** Live-subscribes to one quote's private message thread, oldest first. */
export function useRfqMessages(quoteId: string | undefined) {
  const [messages, setMessages] = useState<RfqMessage[]>([])
  const [loading, setLoading] = useState(Boolean(quoteId))

  useEffect(() => {
    if (!quoteId) {
      setMessages([])
      setLoading(false)
      return
    }
    setLoading(true)
    const q = query(
      collection(db, 'rfqQuotes', quoteId, 'messages').withConverter(clientConverter(rfqMessageConverter)),
      orderBy('createdAt', 'asc'),
    )
    return onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map((d) => d.data()))
      setLoading(false)
    })
  }, [quoteId])

  return { messages, loading }
}
