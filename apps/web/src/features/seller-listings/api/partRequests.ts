import type { PartRequest, SubmitPartRequestRequest, SubmitPartRequestResult } from '@snapspare/shared'
import { partRequestConverter } from '@snapspare/shared'
import { useQuery } from '@tanstack/react-query'
import { httpsCallable } from 'firebase/functions'
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore'
import { db, functions } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

const submitPartRequestCallable = httpsCallable<SubmitPartRequestRequest, SubmitPartRequestResult>(
  functions,
  'submitPartRequest',
)

export async function submitPartRequest(request: SubmitPartRequestRequest): Promise<SubmitPartRequestResult> {
  const result = await submitPartRequestCallable(request)
  return result.data
}

/** A seller's own new-part requests, newest first — their queue-status view (requirement 2). */
export function useSellerPartRequests(sellerId: string | undefined) {
  return useQuery({
    queryKey: ['seller-part-requests', sellerId],
    queryFn: async (): Promise<PartRequest[]> => {
      if (!sellerId) return []
      const snapshot = await getDocs(
        query(
          collection(db, 'partRequests').withConverter(clientConverter(partRequestConverter)),
          where('sellerId', '==', sellerId),
          orderBy('createdAt', 'desc'),
        ),
      )
      return snapshot.docs.map((d) => d.data())
    },
    enabled: Boolean(sellerId),
    staleTime: 15_000,
  })
}
