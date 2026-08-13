import type { SellerSettings } from '@snapspare/shared'
import { sellerSettingsConverter, storeSlugReservationConverter } from '@snapspare/shared'
import { useQuery } from '@tanstack/react-query'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

export interface StoreSeller {
  sellerId: string
  settings: SellerSettings
}

/**
 * Resolves a public store handle to the seller's public-safe data
 * (requirement 7): `storeSlugReservations/{slug}` is the atomic
 * slug-to-sellerId lock (setStoreSlug.ts), `sellers/{sellerId}/settings/general`
 * is the only seller-scoped doc that's publicly readable — it never exposes
 * pan/bankAccount, which live only on the Cloud-Function-only
 * `sellers/{sellerId}` doc this deliberately never reads. `gstin` (Phase 24)
 * is the one exception: it's part of the Consumer Protection Rule 5(4)
 * legal-identity disclosure this doc denormalizes, alongside legalName/
 * registeredAddress.
 */
export function useStoreSeller(slug: string | undefined) {
  return useQuery({
    queryKey: ['store-seller', slug],
    queryFn: async (): Promise<StoreSeller | null> => {
      if (!slug) return null
      const reservationSnapshot = await getDoc(
        doc(db, 'storeSlugReservations', slug).withConverter(clientConverter(storeSlugReservationConverter)),
      )
      if (!reservationSnapshot.exists()) return null
      const { sellerId } = reservationSnapshot.data()

      const settingsSnapshot = await getDoc(
        doc(db, 'sellers', sellerId, 'settings', 'general').withConverter(clientConverter(sellerSettingsConverter)),
      )
      if (!settingsSnapshot.exists()) return null

      return { sellerId, settings: settingsSnapshot.data() }
    },
    enabled: Boolean(slug),
    staleTime: 60_000,
  })
}
