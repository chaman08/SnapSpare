import type { AdminUpdateSellerRequest, AdminUpdateSellerResult, Seller } from '@snapspare/shared'
import { sellerConverter } from '@snapspare/shared'
import { httpsCallable } from 'firebase/functions'
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db, functions } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

/** Admin-only: live list of onboarded sellers (active + suspended), most recently onboarded first. */
export function useAdminSellers(count = 100) {
  const [sellers, setSellers] = useState<Seller[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(collection(db, 'sellers').withConverter(clientConverter(sellerConverter)), orderBy('createdAt', 'desc'), limit(count))
    return onSnapshot(q, (snapshot) => {
      setSellers(snapshot.docs.map((d) => d.data()))
      setLoading(false)
    })
  }, [count])

  return { sellers, loading }
}

const adminUpdateSellerCallable = httpsCallable<AdminUpdateSellerRequest, AdminUpdateSellerResult>(functions, 'adminUpdateSeller')

export async function adminUpdateSeller(request: AdminUpdateSellerRequest): Promise<AdminUpdateSellerResult> {
  const result = await adminUpdateSellerCallable(request)
  return result.data
}
