import type { Return, ReturnsConfig } from '@snapspare/shared'
import { returnConverter, returnsConfigConverter } from '@snapspare/shared'
import { collection, doc, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

/** Returns & disputes module (design brief item 7): every return still in an active state, oldest first. */
export function useOpenReturns() {
  const [returns, setReturns] = useState<Return[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(
      collection(db, 'returns').withConverter(clientConverter(returnConverter)),
      where('status', 'in', ['requested', 'approved', 'qc_disputed']),
      orderBy('requestedAt', 'asc'),
    )
    return onSnapshot(q, (snapshot) => {
      setReturns(snapshot.docs.map((d) => d.data()))
      setLoading(false)
    })
  }, [])

  return { returns, loading }
}

export function useReturnsConfig() {
  const [config, setConfig] = useState<ReturnsConfig | null | undefined>(undefined)

  useEffect(() => {
    return onSnapshot(doc(db, 'config', 'returns').withConverter(clientConverter(returnsConfigConverter)), (snapshot) =>
      setConfig(snapshot.exists() ? snapshot.data() : null),
    )
  }, [])

  return config
}
