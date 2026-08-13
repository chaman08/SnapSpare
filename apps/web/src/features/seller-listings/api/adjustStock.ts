import type { AdjustStockRequest, AdjustStockResult, StockLedgerEntry } from '@snapspare/shared'
import { stockLedgerEntryConverter } from '@snapspare/shared'
import { useQuery } from '@tanstack/react-query'
import { httpsCallable } from 'firebase/functions'
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore'
import { db, functions } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

const adjustStockCallable = httpsCallable<AdjustStockRequest, AdjustStockResult>(functions, 'adjustStock')

export async function adjustStock(request: AdjustStockRequest): Promise<AdjustStockResult> {
  const result = await adjustStockCallable(request)
  return result.data
}

/**
 * Stock movement history for one listing, newest first (requirement 5's
 * stock ledger view). Filters by `sellerId` as well as `listingId` — not
 * just for defense-in-depth, but because firestore.rules' `stockLedger`
 * read rule checks `resource.data.sellerId`, and Firestore rejects a `list`
 * query outright ("Property sellerId is undefined") unless the query
 * itself has an equality filter on every field the rule depends on, so the
 * rules engine can prove every possible result satisfies it without
 * reading each document first.
 */
export function useStockLedger(listingId: string | undefined, sellerId: string | undefined) {
  return useQuery({
    queryKey: ['stock-ledger', listingId, sellerId],
    queryFn: async (): Promise<StockLedgerEntry[]> => {
      if (!listingId || !sellerId) return []
      const snapshot = await getDocs(
        query(
          collection(db, 'stockLedger').withConverter(clientConverter(stockLedgerEntryConverter)),
          where('listingId', '==', listingId),
          where('sellerId', '==', sellerId),
          orderBy('createdAt', 'desc'),
        ),
      )
      return snapshot.docs.map((d) => d.data())
    },
    enabled: Boolean(listingId) && Boolean(sellerId),
    staleTime: 10_000,
  })
}
