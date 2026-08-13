import type { PartRequest, ReviewPartRequestRequest, ReviewPartRequestResult } from '@snapspare/shared'
import { partRequestConverter } from '@snapspare/shared'
import { httpsCallable } from 'firebase/functions'
import { collection, doc, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db, functions } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

/** Admin-only: live-subscribes to part requests awaiting a decision (pending or already under_review). */
export function usePendingPartRequests() {
  const [requests, setRequests] = useState<PartRequest[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(
      collection(db, 'partRequests').withConverter(clientConverter(partRequestConverter)),
      where('status', 'in', ['pending', 'under_review']),
      orderBy('createdAt', 'asc'),
    )
    return onSnapshot(q, (snapshot) => {
      setRequests(snapshot.docs.map((d) => d.data()))
      setLoading(false)
    })
  }, [])

  return { requests, loading }
}

/** Admin-only: single part request by id, for the review detail screen. */
export function usePartRequestDetail(requestId: string | undefined) {
  const [request, setRequest] = useState<PartRequest | null | undefined>(undefined)

  useEffect(() => {
    if (!requestId) {
      setRequest(null)
      return
    }
    setRequest(undefined)
    return onSnapshot(
      doc(db, 'partRequests', requestId).withConverter(clientConverter(partRequestConverter)),
      (snapshot) => setRequest(snapshot.exists() ? snapshot.data() : null),
    )
  }, [requestId])

  return { request, loading: request === undefined }
}

const reviewPartRequestCallable = httpsCallable<ReviewPartRequestRequest, ReviewPartRequestResult>(
  functions,
  'reviewPartRequest',
)

export async function reviewPartRequest(request: ReviewPartRequestRequest): Promise<ReviewPartRequestResult> {
  const result = await reviewPartRequestCallable(request)
  return result.data
}
