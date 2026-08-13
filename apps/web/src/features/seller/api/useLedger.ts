import type { Ledger, LedgerEntry } from '@snapspare/shared'
import { ledgerConverter, ledgerEntryConverter } from '@snapspare/shared'
import { collection, doc, limit, onSnapshot, orderBy, query } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

const RECENT_ENTRIES_LIMIT = 50

/** Live-subscribes to a seller's ledger balance and most recent entries (design brief item 6: "current balance ... a per-order money breakdown"). Balance is always the ledger doc's `currentBalancePaise`, itself always the sum of every entry ever posted — see functions/src/tax/ledger.ts. */
export function useLedger(sellerId: string | undefined): {
  ledger: Ledger | null
  entries: LedgerEntry[]
  loading: boolean
} {
  const [ledger, setLedger] = useState<Ledger | null>(null)
  const [entries, setEntries] = useState<LedgerEntry[]>([])
  const [ledgerLoading, setLedgerLoading] = useState(Boolean(sellerId))
  const [entriesLoading, setEntriesLoading] = useState(Boolean(sellerId))

  useEffect(() => {
    if (!sellerId) {
      setLedger(null)
      setLedgerLoading(false)
      return
    }
    setLedgerLoading(true)
    const ref = doc(db, 'ledgers', sellerId).withConverter(clientConverter(ledgerConverter))
    return onSnapshot(
      ref,
      (snapshot) => {
        setLedger(snapshot.exists() ? snapshot.data() : null)
        setLedgerLoading(false)
      },
      () => setLedgerLoading(false),
    )
  }, [sellerId])

  useEffect(() => {
    if (!sellerId) {
      setEntries([])
      setEntriesLoading(false)
      return
    }
    setEntriesLoading(true)
    const q = query(
      collection(db, 'ledgers', sellerId, 'entries').withConverter(clientConverter(ledgerEntryConverter)),
      orderBy('createdAt', 'desc'),
      limit(RECENT_ENTRIES_LIMIT),
    )
    return onSnapshot(
      q,
      (snapshot) => {
        setEntries(snapshot.docs.map((d) => d.data()))
        setEntriesLoading(false)
      },
      () => setEntriesLoading(false),
    )
  }, [sellerId])

  return { ledger, entries, loading: ledgerLoading || entriesLoading }
}
