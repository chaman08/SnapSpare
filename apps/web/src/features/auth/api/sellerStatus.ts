import { sellerConverter } from '@snapspare/shared'
import { useQuery } from '@tanstack/react-query'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

/** Live seller status check for the /seller/* route guard — a claim alone can go stale if a seller is later suspended. */
export function useSellerStatus(sellerId: string | undefined) {
  return useQuery({
    queryKey: ['seller-status', sellerId],
    queryFn: async () => {
      if (!sellerId) return null
      const snapshot = await getDoc(doc(db, 'sellers', sellerId).withConverter(clientConverter(sellerConverter)))
      return snapshot.exists() ? snapshot.data() : null
    },
    enabled: Boolean(sellerId),
    staleTime: 60_000,
  })
}
