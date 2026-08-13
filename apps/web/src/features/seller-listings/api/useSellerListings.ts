import type { Listing, ListingStatus } from '@snapspare/shared'
import { listingConverter } from '@snapspare/shared'
import { useQuery } from '@tanstack/react-query'
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

export type SellerListingsStatusFilter = ListingStatus | 'all'

/**
 * A seller's own listings, newest first. `status: 'all'` omits the status
 * equality filter and uses the (sellerId, createdAt) index instead of the
 * (sellerId, status, createdAt) one — see firestore.indexes.json, both are
 * provisioned so per-status tabs and an "All" tab both stay index-backed.
 */
export function useSellerListings(sellerId: string | undefined, status: SellerListingsStatusFilter) {
  return useQuery({
    queryKey: ['seller-listings', sellerId, status],
    queryFn: async (): Promise<Listing[]> => {
      if (!sellerId) return []
      const listingsRef = collection(db, 'listings').withConverter(clientConverter(listingConverter))
      const q =
        status === 'all'
          ? query(listingsRef, where('sellerId', '==', sellerId), orderBy('createdAt', 'desc'))
          : query(
              listingsRef,
              where('sellerId', '==', sellerId),
              where('status', '==', status),
              orderBy('createdAt', 'desc'),
            )
      const snapshot = await getDocs(q)
      return snapshot.docs.map((d) => d.data())
    },
    enabled: Boolean(sellerId),
    staleTime: 10_000,
  })
}
