import type { SellerTrustScore } from '@snapspare/shared'
import { sellerConverter } from '@snapspare/shared'
import { useQuery } from '@tanstack/react-query'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

/** Seller-facing detailed trust score breakdown (design brief item 5) — reads the private `sellers/{sellerId}` doc, readable only by the seller themselves or an admin (see firestore.rules), unlike the public tier-only mirror on settings/general that SellerTrustBadge uses. */
export function useSellerTrustScore(sellerId: string | undefined) {
  return useQuery({
    queryKey: ['seller-trust-score', sellerId],
    queryFn: async (): Promise<SellerTrustScore | undefined> => {
      if (!sellerId) return undefined
      const snapshot = await getDoc(doc(db, 'sellers', sellerId).withConverter(clientConverter(sellerConverter)))
      return snapshot.exists() ? snapshot.data().trustScore : undefined
    },
    enabled: Boolean(sellerId),
    staleTime: 60_000,
  })
}
