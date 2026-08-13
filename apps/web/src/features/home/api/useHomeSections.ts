import type { HomeSection } from '@snapspare/shared'
import { homeSectionConverter } from '@snapspare/shared'
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

/** Buyer-facing homepage layout (Phase 20 design brief item 1) — only `active` sections, in admin-configured order. */
export function useHomeSections() {
  const [sections, setSections] = useState<HomeSection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    const q = query(
      collection(db, 'homeSections').withConverter(clientConverter(homeSectionConverter)),
      where('status', '==', 'active'),
      orderBy('sortOrder', 'asc'),
    )
    return onSnapshot(
      q,
      (snapshot) => {
        setSections(snapshot.docs.map((d) => d.data()))
        setLoading(false)
        setError(false)
      },
      () => {
        setLoading(false)
        setError(true)
      },
    )
  }, [])

  return { sections, loading, error }
}
