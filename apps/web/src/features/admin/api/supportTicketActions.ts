import type {
  RespondToSupportTicketRequest,
  RespondToSupportTicketResult,
  ResolveSupportTicketRequest,
  ResolveSupportTicketResult,
  SupportTicket,
} from '@snapspare/shared'
import { supportTicketConverter } from '@snapspare/shared'
import { collection, doc, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { useEffect, useState } from 'react'
import { db, functions } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

/** Admin-only: live-subscribes to every unresolved support ticket (Phase 24's contact-form queue) — same shape as disputeActions.ts's useOpenDisputes. */
export function useOpenSupportTickets(): { tickets: SupportTicket[]; loading: boolean } {
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(
      collection(db, 'supportTickets').withConverter(clientConverter(supportTicketConverter)),
      where('status', 'in', ['open', 'in_progress']),
      orderBy('slaBreachAt', 'asc'),
    )
    return onSnapshot(q, (snapshot) => {
      setTickets(snapshot.docs.map((d) => d.data()))
      setLoading(false)
    })
  }, [])

  return { tickets, loading }
}

export function useSupportTicketDetail(ticketId: string | undefined) {
  const [ticket, setTicket] = useState<SupportTicket | null | undefined>(undefined)

  useEffect(() => {
    if (!ticketId) {
      setTicket(null)
      return
    }
    setTicket(undefined)
    return onSnapshot(
      doc(db, 'supportTickets', ticketId).withConverter(clientConverter(supportTicketConverter)),
      (snapshot) => setTicket(snapshot.exists() ? snapshot.data() : null),
    )
  }, [ticketId])

  return { ticket, loading: ticket === undefined }
}

const respondToSupportTicketCallable = httpsCallable<RespondToSupportTicketRequest, RespondToSupportTicketResult>(
  functions,
  'respondToSupportTicket',
)
export const respondToSupportTicket = (request: RespondToSupportTicketRequest) =>
  respondToSupportTicketCallable(request).then((r) => r.data)

const resolveSupportTicketCallable = httpsCallable<ResolveSupportTicketRequest, ResolveSupportTicketResult>(
  functions,
  'resolveSupportTicket',
)
export const resolveSupportTicket = (request: ResolveSupportTicketRequest) =>
  resolveSupportTicketCallable(request).then((r) => r.data)
