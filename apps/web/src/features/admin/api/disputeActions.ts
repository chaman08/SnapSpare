import type { Dispute, ResolveDisputeRequest, ResolveDisputeResult } from '@snapspare/shared'
import { disputeConverter } from '@snapspare/shared'
import { collection, doc, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { useEffect, useState } from 'react'
import { db, functions } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

/** Admin-only: live-subscribes to every unresolved dispute (design brief item 7's admin escalation queue). */
export function useOpenDisputes(): { disputes: Dispute[]; loading: boolean } {
  const [disputes, setDisputes] = useState<Dispute[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(
      collection(db, 'disputes').withConverter(clientConverter(disputeConverter)),
      where('status', 'in', ['open', 'under_review']),
      orderBy('slaBreachAt', 'asc'),
    )
    return onSnapshot(q, (snapshot) => {
      setDisputes(snapshot.docs.map((d) => d.data()))
      setLoading(false)
    })
  }, [])

  return { disputes, loading }
}

export function useDisputeDetail(disputeId: string | undefined) {
  const [dispute, setDispute] = useState<Dispute | null | undefined>(undefined)

  useEffect(() => {
    if (!disputeId) {
      setDispute(null)
      return
    }
    setDispute(undefined)
    return onSnapshot(
      doc(db, 'disputes', disputeId).withConverter(clientConverter(disputeConverter)),
      (snapshot) => setDispute(snapshot.exists() ? snapshot.data() : null),
    )
  }, [disputeId])

  return { dispute, loading: dispute === undefined }
}

const resolveDisputeCallable = httpsCallable<ResolveDisputeRequest, ResolveDisputeResult>(functions, 'resolveDispute')

export const resolveDispute = (request: ResolveDisputeRequest) => resolveDisputeCallable(request).then((r) => r.data)
