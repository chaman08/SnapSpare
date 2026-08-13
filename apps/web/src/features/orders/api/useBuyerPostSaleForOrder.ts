import type { Return, WarrantyClaim } from '@snapspare/shared'
import { returnConverter, warrantyClaimConverter } from '@snapspare/shared'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

/**
 * Live-subscribes to the signed-in buyer's returns for this order — backs
 * OrderDetailPage's per-subOrder return status + "open a dispute" action
 * once QC disputes it. Filters on both `orderId` and `buyerId` — Firestore
 * security rules can only allow a *list* query (as opposed to a single-doc
 * get) when every field the rule reads (here, `resource.data.buyerId`) is
 * also constrained by an equality filter in the query itself.
 */
export function useBuyerReturnsForOrder(orderId: string | undefined, buyerId: string | undefined): Return[] {
  const [returns, setReturns] = useState<Return[]>([])

  useEffect(() => {
    if (!orderId || !buyerId) {
      setReturns([])
      return
    }
    const q = query(
      collection(db, 'returns').withConverter(clientConverter(returnConverter)),
      where('orderId', '==', orderId),
      where('buyerId', '==', buyerId),
    )
    return onSnapshot(q, (snapshot) => setReturns(snapshot.docs.map((d) => d.data())), () => setReturns([]))
  }, [orderId, buyerId])

  return returns
}

/** Same as useBuyerReturnsForOrder, for warranty claims. */
export function useBuyerWarrantyClaimsForOrder(orderId: string | undefined, buyerId: string | undefined): WarrantyClaim[] {
  const [claims, setClaims] = useState<WarrantyClaim[]>([])

  useEffect(() => {
    if (!orderId || !buyerId) {
      setClaims([])
      return
    }
    const q = query(
      collection(db, 'warrantyClaims').withConverter(clientConverter(warrantyClaimConverter)),
      where('orderId', '==', orderId),
      where('buyerId', '==', buyerId),
    )
    return onSnapshot(q, (snapshot) => setClaims(snapshot.docs.map((d) => d.data())), () => setClaims([]))
  }, [orderId, buyerId])

  return claims
}
