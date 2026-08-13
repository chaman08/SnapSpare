import type { WarrantyClaim } from '@snapspare/shared'
import { warrantyClaimConverter } from '@snapspare/shared'
import { collection, doc, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

/** Admin-only: live-subscribes to brand-escalated warranty claims (design brief item 6 — admin-mediated brand escalation queue, since no brand-contact directory exists). */
export function useEscalatedWarrantyClaims(): { claims: WarrantyClaim[]; loading: boolean } {
  const [claims, setClaims] = useState<WarrantyClaim[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(
      collection(db, 'warrantyClaims').withConverter(clientConverter(warrantyClaimConverter)),
      where('status', '==', 'escalated_to_brand'),
      orderBy('escalatedToBrandAt', 'asc'),
    )
    return onSnapshot(q, (snapshot) => {
      setClaims(snapshot.docs.map((d) => d.data()))
      setLoading(false)
    })
  }, [])

  return { claims, loading }
}

export function useWarrantyClaimDetail(claimId: string | undefined) {
  const [claim, setClaim] = useState<WarrantyClaim | null | undefined>(undefined)

  useEffect(() => {
    if (!claimId) {
      setClaim(null)
      return
    }
    setClaim(undefined)
    return onSnapshot(
      doc(db, 'warrantyClaims', claimId).withConverter(clientConverter(warrantyClaimConverter)),
      (snapshot) => setClaim(snapshot.exists() ? snapshot.data() : null),
    )
  }, [claimId])

  return { claim, loading: claim === undefined }
}
