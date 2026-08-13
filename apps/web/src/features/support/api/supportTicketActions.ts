import type { CreateSupportTicketRequest, CreateSupportTicketResult, SupportTicket } from '@snapspare/shared'
import { supportTicketConverter } from '@snapspare/shared'
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { useEffect, useState } from 'react'
import { db, functions } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

const createSupportTicketCallable = httpsCallable<CreateSupportTicketRequest, CreateSupportTicketResult>(
  functions,
  'createSupportTicket',
)
export const createSupportTicket = (request: CreateSupportTicketRequest) => createSupportTicketCallable(request).then((r) => r.data)

/** Signed-in user's own ticket history — Account/Support screen. Guest (not-signed-in) tickets have no owner uid to query by, so they never show up here; the contact form is still their only way to reach support either way. */
export function useMySupportTickets(userId: string | undefined) {
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) {
      setTickets([])
      setLoading(false)
      return
    }
    const q = query(
      collection(db, 'supportTickets').withConverter(clientConverter(supportTicketConverter)),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
    )
    return onSnapshot(q, (snapshot) => {
      setTickets(snapshot.docs.map((d) => d.data()))
      setLoading(false)
    })
  }, [userId])

  return { tickets, loading }
}
