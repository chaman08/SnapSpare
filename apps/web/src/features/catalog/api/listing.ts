import { listingConverter } from '@snapspare/shared'
import { useQuery } from '@tanstack/react-query'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

/** Shared by cart line items and the cart fitment guard so both get the listing title/image from one cached fetch instead of two. */
export function useListing(listingId: string) {
  return useQuery({
    queryKey: ['listing', listingId],
    queryFn: async () => {
      const snapshot = await getDoc(
        doc(db, 'listings', listingId).withConverter(clientConverter(listingConverter)),
      )
      return snapshot.exists() ? snapshot.data() : null
    },
    enabled: Boolean(listingId),
    staleTime: 60_000,
  })
}
