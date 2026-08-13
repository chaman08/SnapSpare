import type { ReviewSellerApplicationRequest, ReviewSellerApplicationResult, SellerApplication } from '@snapspare/shared'
import { sellerApplicationConverter } from '@snapspare/shared'
import { httpsCallable } from 'firebase/functions'
import { collection, doc, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db, functions } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

/** Admin-only: live-subscribes to seller applications awaiting a decision (submitted or already under_review). */
export function usePendingSellerApplications() {
  const [applications, setApplications] = useState<SellerApplication[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(
      collection(db, 'sellerApplications').withConverter(clientConverter(sellerApplicationConverter)),
      where('status', 'in', ['submitted', 'under_review']),
      orderBy('submittedAt', 'asc'),
    )
    return onSnapshot(q, (snapshot) => {
      setApplications(snapshot.docs.map((d) => d.data()))
      setLoading(false)
    })
  }, [])

  return { applications, loading }
}

/** Admin-only: single application by id, for the review detail screen. */
export function useSellerApplicationDetail(applicationId: string | undefined) {
  const [application, setApplication] = useState<SellerApplication | null | undefined>(undefined)

  useEffect(() => {
    if (!applicationId) {
      setApplication(null)
      return
    }
    setApplication(undefined)
    return onSnapshot(
      doc(db, 'sellerApplications', applicationId).withConverter(clientConverter(sellerApplicationConverter)),
      (snapshot) => setApplication(snapshot.exists() ? snapshot.data() : null),
    )
  }, [applicationId])

  return { application, loading: application === undefined }
}

const reviewSellerApplicationCallable = httpsCallable<ReviewSellerApplicationRequest, ReviewSellerApplicationResult>(
  functions,
  'reviewSellerApplication',
)

export async function reviewSellerApplication(request: ReviewSellerApplicationRequest): Promise<ReviewSellerApplicationResult> {
  const result = await reviewSellerApplicationCallable(request)
  return result.data
}
