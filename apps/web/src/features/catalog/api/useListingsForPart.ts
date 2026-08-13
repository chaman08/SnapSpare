import type { Listing } from '@snapspare/shared'
import { listingConverter } from '@snapspare/shared'
import { useQuery } from '@tanstack/react-query'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

/**
 * Every active listing for one catalog part, across every seller — the
 * "other seller offers" list on the product detail page. Read straight from
 * Firestore (not Typesense) so pricing.tiers, the full slab ladder, is
 * always exact and current — the search index only carries a two-point
 * summary (basePricePaise/minPricePaise), which is enough for a card but not
 * for the page whose whole job is to show the slab ladder in full. Two
 * equality filters (partId, status) don't need a composite index — see
 * firestore.indexes.json's comment history / Firestore's automatic
 * single-field-index merge for AND-of-equality queries.
 */
export function useListingsForPart(partId: string | undefined) {
  return useQuery({
    queryKey: ['listings-for-part', partId],
    queryFn: async (): Promise<Listing[]> => {
      if (!partId) return []
      const snapshot = await getDocs(
        query(
          collection(db, 'listings').withConverter(clientConverter(listingConverter)),
          where('partId', '==', partId),
          where('status', '==', 'active'),
        ),
      )
      return snapshot.docs.map((d) => d.data())
    },
    enabled: Boolean(partId),
    staleTime: 30_000,
  })
}
