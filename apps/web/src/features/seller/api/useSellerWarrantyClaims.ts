import type { WarrantyClaim } from '@snapspare/shared'
import { warrantyClaimConverter } from '@snapspare/shared'
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

/** Live-subscribes to every warranty claim against this seller — backs SellerWarrantyClaimsPage. */
export function useSellerWarrantyClaims(sellerId: string | undefined): { claims: WarrantyClaim[]; loading: boolean } {
  const [claims, setClaims] = useState<WarrantyClaim[]>([])
  const [loading, setLoading] = useState(Boolean(sellerId))

  useEffect(() => {
    if (!sellerId) {
      setClaims([])
      setLoading(false)
      return
    }
    setLoading(true)
    const q = query(
      collection(db, 'warrantyClaims').withConverter(clientConverter(warrantyClaimConverter)),
      where('sellerId', '==', sellerId),
      orderBy('createdAt', 'desc'),
    )
    return onSnapshot(
      q,
      (snapshot) => {
        setClaims(snapshot.docs.map((d) => d.data()))
        setLoading(false)
      },
      () => setLoading(false),
    )
  }, [sellerId])

  return { claims, loading }
}
