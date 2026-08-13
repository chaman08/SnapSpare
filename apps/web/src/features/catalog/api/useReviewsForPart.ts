import type { Review } from '@snapspare/shared'
import { reviewConverter } from '@snapspare/shared'
import { useQuery } from '@tanstack/react-query'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

const FIRESTORE_IN_CHUNK = 10

/**
 * Reviews are stored per-listing (see reviewSchema), but the PDP's Reviews
 * tab is per-part — a buyer doesn't care which seller a past reviewer
 * bought from, only what people said about the part itself. Fans out one
 * `listingId in [...]` query per 10 listings (Firestore's `in` cap) rather
 * than one query per listing, then merges and sorts client-side; a part
 * rarely has more than a handful of active listings so this is at most a
 * couple of round trips.
 */
export function useReviewsForPart(partId: string | undefined, listingIds: string[]) {
  const sortedIds = [...listingIds].sort()

  return useQuery({
    queryKey: ['reviews-for-part', partId, sortedIds],
    queryFn: async (): Promise<Review[]> => {
      if (sortedIds.length === 0) return []
      const chunks: string[][] = []
      for (let i = 0; i < sortedIds.length; i += FIRESTORE_IN_CHUNK) {
        chunks.push(sortedIds.slice(i, i + FIRESTORE_IN_CHUNK))
      }

      const snapshots = await Promise.all(
        chunks.map((chunk) =>
          getDocs(
            query(
              collection(db, 'reviews').withConverter(clientConverter(reviewConverter)),
              where('listingId', 'in', chunk),
              where('status', '==', 'published'),
            ),
          ),
        ),
      )

      return snapshots
        .flatMap((snapshot) => snapshot.docs.map((d) => d.data()))
        .sort((a, b) => b.createdAt - a.createdAt)
    },
    enabled: Boolean(partId) && sortedIds.length > 0,
    staleTime: 30_000,
  })
}
