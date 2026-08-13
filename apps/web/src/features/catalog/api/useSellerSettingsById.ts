import type { SellerSettings } from '@snapspare/shared'
import { sellerSettingsConverter } from '@snapspare/shared'
import { useQuery } from '@tanstack/react-query'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

/**
 * Public read of `sellers/{sellerId}/settings/general` keyed directly by
 * sellerId (not a store-slug lookup) — the same publicly-readable doc
 * `useStoreSeller.ts` resolves via slug, used here by the product page's
 * Consumer Protection Rule 5(4) seller disclosure block.
 */
export function useSellerSettingsById(sellerId: string | undefined) {
  return useQuery({
    queryKey: ['seller-settings', sellerId],
    queryFn: async (): Promise<SellerSettings | null> => {
      if (!sellerId) return null
      const snapshot = await getDoc(doc(db, 'sellers', sellerId, 'settings', 'general').withConverter(clientConverter(sellerSettingsConverter)))
      return snapshot.exists() ? snapshot.data() : null
    },
    enabled: Boolean(sellerId),
    staleTime: 5 * 60_000,
  })
}
