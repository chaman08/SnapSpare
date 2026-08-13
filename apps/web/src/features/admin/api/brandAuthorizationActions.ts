import type { BrandAuthorization, ReviewBrandAuthorizationRequest } from '@snapspare/shared'
import { brandAuthorizationConverter } from '@snapspare/shared'
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { useEffect, useState } from 'react'
import { db, functions } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

/** Admin-only: live-subscribes to brand-authorization documents awaiting a decision. */
export function usePendingBrandAuthorizations() {
  const [authorizations, setAuthorizations] = useState<BrandAuthorization[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(
      collection(db, 'brandAuthorizations').withConverter(clientConverter(brandAuthorizationConverter)),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'asc'),
    )
    return onSnapshot(q, (snapshot) => {
      setAuthorizations(snapshot.docs.map((d) => d.data()))
      setLoading(false)
    })
  }, [])

  return { authorizations, loading }
}

const reviewBrandAuthorizationCallable = httpsCallable<ReviewBrandAuthorizationRequest, { status: string }>(
  functions,
  'reviewBrandAuthorization',
)

export const reviewBrandAuthorization = (request: ReviewBrandAuthorizationRequest) =>
  reviewBrandAuthorizationCallable(request).then((r) => r.data)
