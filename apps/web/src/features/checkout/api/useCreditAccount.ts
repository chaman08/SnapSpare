import type { CreditAccount } from '@snapspare/shared'
import { creditAccountConverter } from '@snapspare/shared'
import { collection, limit, onSnapshot, query, where } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

/** Live-subscribes to the signed-in buyer's credit account, if any — "Pay on credit (30 days)" only appears at checkout when this exists, is active, and has enough availableCreditPaise for the order (re-checked server-side by createOrder regardless of what this shows). Doc id isn't the buyer id (see packages/seed/src/seeders/seedBuyers.ts), so this queries by the buyerId field instead of doc()-ing directly. */
export function useCreditAccount(userId: string | undefined): { creditAccount: CreditAccount | null; loading: boolean } {
  const [creditAccount, setCreditAccount] = useState<CreditAccount | null>(null)
  const [loading, setLoading] = useState(Boolean(userId))

  useEffect(() => {
    if (!userId) {
      setCreditAccount(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const q = query(
      collection(db, 'creditAccounts').withConverter(clientConverter(creditAccountConverter)),
      where('buyerId', '==', userId),
      limit(1),
    )
    return onSnapshot(
      q,
      (snapshot) => {
        setCreditAccount(snapshot.empty ? null : (snapshot.docs[0]?.data() ?? null))
        setLoading(false)
      },
      () => setLoading(false),
    )
  }, [userId])

  return { creditAccount, loading }
}
