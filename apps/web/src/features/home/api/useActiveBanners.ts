import type { Banner } from '@snapspare/shared'
import { bannerConverter } from '@snapspare/shared'
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

/**
 * Buyer-facing active banners for one slot. Firestore rules only gate on
 * `status` (see firestore.rules) — `startAt`/`endAt` scheduling is checked
 * client-side on every snapshot, same as any other short-lived promo window,
 * since re-evaluating two number comparisons on read is cheaper than a
 * scheduled function that flips `status` at the edges.
 */
export function useActiveBanners(slot: Banner['slot']) {
  const [banners, setBanners] = useState<Banner[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(
      collection(db, 'banners').withConverter(clientConverter(bannerConverter)),
      where('slot', '==', slot),
      where('status', '==', 'active'),
      orderBy('sortOrder', 'asc'),
    )
    return onSnapshot(q, (snapshot) => {
      const now = Date.now()
      setBanners(snapshot.docs.map((d) => d.data()).filter((banner) => banner.startAt <= now && now <= banner.endAt))
      setLoading(false)
    })
  }, [slot])

  return { banners, loading }
}
