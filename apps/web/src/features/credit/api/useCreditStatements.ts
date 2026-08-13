import type { CreditStatement } from '@snapspare/shared'
import { creditStatementConverter } from '@snapspare/shared'
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

/** Live-subscribes to a buyer's Khata statements, newest first. */
export function useCreditStatements(buyerId: string | undefined): { statements: CreditStatement[]; loading: boolean } {
  const [statements, setStatements] = useState<CreditStatement[]>([])
  const [loading, setLoading] = useState(Boolean(buyerId))

  useEffect(() => {
    if (!buyerId) {
      setStatements([])
      setLoading(false)
      return
    }
    setLoading(true)
    const q = query(
      collection(db, 'creditStatements').withConverter(clientConverter(creditStatementConverter)),
      where('buyerId', '==', buyerId),
      orderBy('periodTo', 'desc'),
    )
    return onSnapshot(
      q,
      (snapshot) => {
        setStatements(snapshot.docs.map((d) => d.data()))
        setLoading(false)
      },
      () => setLoading(false),
    )
  }, [buyerId])

  return { statements, loading }
}
