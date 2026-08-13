import type {
  AdminSetListingStatusRequest,
  AdminSetListingStatusResult,
  GetListingAnomalyReportResult,
  Listing,
} from '@snapspare/shared'
import { listingConverter } from '@snapspare/shared'
import { useQuery } from '@tanstack/react-query'
import { httpsCallable } from 'firebase/functions'
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db, functions } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

/** Recent listings, optionally filtered to one seller — see the module's left-out note on full-text search. */
export function useAdminListings(sellerId: string, count = 50) {
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const base = collection(db, 'listings').withConverter(clientConverter(listingConverter))
    // Filtering by sellerId skips orderBy to avoid needing a new composite
    // index just for this admin lookup — results are simply unordered.
    const q = sellerId.trim()
      ? query(base, where('sellerId', '==', sellerId.trim()), limit(count))
      : query(base, orderBy('updatedAt', 'desc'), limit(count))
    return onSnapshot(q, (snapshot) => {
      setListings(snapshot.docs.map((d) => d.data()))
      setLoading(false)
    })
  }, [sellerId, count])

  return { listings, loading }
}

const adminSetListingStatusCallable = httpsCallable<AdminSetListingStatusRequest, AdminSetListingStatusResult>(
  functions,
  'adminSetListingStatus',
)
export async function adminSetListingStatus(request: AdminSetListingStatusRequest): Promise<AdminSetListingStatusResult> {
  return (await adminSetListingStatusCallable(request)).data
}

const getListingAnomalyReportCallable = httpsCallable<Record<string, never>, GetListingAnomalyReportResult>(
  functions,
  'getListingAnomalyReport',
)
export function useListingAnomalyReport() {
  return useQuery({
    queryKey: ['admin-listing-anomaly-report'],
    queryFn: async () => (await getListingAnomalyReportCallable({})).data,
    staleTime: 60_000,
  })
}
