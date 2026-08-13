import type { Review } from '@snapspare/shared'
import { reviewConverter } from '@snapspare/shared'
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { useEffect, useState } from 'react'
import { db, functions } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

/** Admin-only: live-subscribes to reviews the automated screen flagged (contact-info/profanity/PII) — status stays 'pending' until an admin approves/rejects, see onReviewWrite.ts. */
export function usePendingFlaggedReviews() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(
      collection(db, 'reviews').withConverter(clientConverter(reviewConverter)),
      where('status', '==', 'pending'),
      where('moderationStatus', '==', 'flagged'),
      orderBy('createdAt', 'asc'),
    )
    return onSnapshot(q, (snapshot) => {
      setReviews(snapshot.docs.map((d) => d.data()))
      setLoading(false)
    })
  }, [])

  return { reviews, loading }
}

interface ModerateReviewRequest {
  reviewId: string
  action: 'approve' | 'reject'
  notes?: string
}

const moderateReviewCallable = httpsCallable<ModerateReviewRequest, { status: string }>(functions, 'moderateReview')

export const moderateReview = (request: ModerateReviewRequest) => moderateReviewCallable(request).then((r) => r.data)
