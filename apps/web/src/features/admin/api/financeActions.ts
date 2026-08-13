import type {
  CommissionConfig,
  LedgerEntry,
  Payout,
  TriggerPayoutRunRequest,
  TriggerPayoutRunResult,
  UpdateCommissionConfigRequest,
  UpdateCommissionConfigResult,
} from '@snapspare/shared'
import { commissionConfigConverter, ledgerEntryConverter, payoutConverter } from '@snapspare/shared'
import { useQuery } from '@tanstack/react-query'
import { httpsCallable } from 'firebase/functions'
import { collection, collectionGroup, doc, getDocs, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db, functions } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

export function useCommissionConfig() {
  const [config, setConfig] = useState<CommissionConfig | null | undefined>(undefined)

  useEffect(() => {
    return onSnapshot(
      doc(db, 'config', 'commission').withConverter(clientConverter(commissionConfigConverter)),
      (snapshot) => setConfig(snapshot.exists() ? snapshot.data() : null),
    )
  }, [])

  return { config, loading: config === undefined }
}

const updateCommissionConfigCallable = httpsCallable<UpdateCommissionConfigRequest, UpdateCommissionConfigResult>(
  functions,
  'updateCommissionConfig',
)
export async function updateCommissionConfig(request: UpdateCommissionConfigRequest): Promise<UpdateCommissionConfigResult> {
  return (await updateCommissionConfigCallable(request)).data
}

const triggerPayoutRunCallable = httpsCallable<TriggerPayoutRunRequest, TriggerPayoutRunResult>(functions, 'triggerPayoutRun')
export async function triggerPayoutRun(): Promise<TriggerPayoutRunResult> {
  return (await triggerPayoutRunCallable({})).data
}

/** Live list of the most recent payout runs, across all sellers. */
export function useRecentPayouts(count = 50) {
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(collection(db, 'payouts').withConverter(clientConverter(payoutConverter)), orderBy('createdAt', 'desc'), limit(count))
    return onSnapshot(q, (snapshot) => {
      setPayouts(snapshot.docs.map((d) => d.data()))
      setLoading(false)
    })
  }, [count])

  return { payouts, loading }
}

/** Ledger explorer: one seller's running-balance entry history, most recent first. */
export function useLedgerEntries(sellerId: string) {
  return useQuery({
    queryKey: ['admin-ledger-entries', sellerId],
    queryFn: async (): Promise<LedgerEntry[]> => {
      const snapshot = await getDocs(
        query(
          collection(db, 'ledgers', sellerId, 'entries').withConverter(clientConverter(ledgerEntryConverter)),
          orderBy('createdAt', 'desc'),
          limit(100),
        ),
      )
      return snapshot.docs.map((d) => d.data())
    },
    enabled: sellerId.trim().length > 0,
  })
}

/** Refund register: every refund-type ledger entry across all sellers (collection-group query — see firestore.rules' `entries` subcollection block for why this is admin-readable regardless of depth). */
export function useRefundRegister() {
  return useQuery({
    queryKey: ['admin-refund-register'],
    queryFn: async (): Promise<LedgerEntry[]> => {
      const snapshot = await getDocs(
        query(
          collectionGroup(db, 'entries').withConverter(clientConverter(ledgerEntryConverter)),
          where('type', 'in', ['refund_debit', 'dispute_refund_debit']),
          orderBy('createdAt', 'desc'),
          limit(100),
        ),
      )
      return snapshot.docs.map((d) => d.data())
    },
    staleTime: 30_000,
  })
}
