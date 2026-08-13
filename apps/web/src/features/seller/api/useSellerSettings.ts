import type { SellerSettings } from '@snapspare/shared'
import { sellerSettingsConverter } from '@snapspare/shared'
import { doc, onSnapshot } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

/** Live-subscribes to `sellers/{sellerId}/settings/general` — created at approval time by reviewSellerApplication.ts, so it should always exist for an active seller. */
export function useSellerSettings(sellerId: string | undefined) {
  const [settings, setSettings] = useState<SellerSettings | null | undefined>(undefined)

  useEffect(() => {
    if (!sellerId) {
      setSettings(null)
      return
    }
    setSettings(undefined)
    return onSnapshot(
      doc(db, 'sellers', sellerId, 'settings', 'general').withConverter(clientConverter(sellerSettingsConverter)),
      (snapshot) => setSettings(snapshot.exists() ? snapshot.data() : null),
    )
  }, [sellerId])

  return { settings, loading: settings === undefined }
}
