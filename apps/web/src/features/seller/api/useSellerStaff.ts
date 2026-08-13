import type { SellerStaff } from '@snapspare/shared'
import { sellerStaffConverter } from '@snapspare/shared'
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

/** Live-subscribes to a seller's staff roster (invited + active + removed, newest first) — firestore.rules scopes reads to the seller's own sellerId. */
export function useSellerStaff(sellerId: string | undefined) {
  const [staff, setStaff] = useState<SellerStaff[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!sellerId) {
      setStaff([])
      setLoading(false)
      return
    }
    setLoading(true)
    const q = query(
      collection(db, 'sellerStaff').withConverter(clientConverter(sellerStaffConverter)),
      where('sellerId', '==', sellerId),
      orderBy('createdAt', 'desc'),
    )
    return onSnapshot(q, (snapshot) => {
      setStaff(snapshot.docs.map((d) => d.data()))
      setLoading(false)
    })
  }, [sellerId])

  return { staff, loading }
}
