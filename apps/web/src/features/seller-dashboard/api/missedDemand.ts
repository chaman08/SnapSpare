import type { GetMissedDemandForSellerResult } from '@snapspare/shared'
import { useQuery } from '@tanstack/react-query'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/lib/firebase'

const getMissedDemandForSellerCallable = httpsCallable<Record<string, never>, GetMissedDemandForSellerResult>(
  functions,
  'getMissedDemandForSeller',
)

/** Requirement 6's "missed demand" panel — searches buyers ran that matched nothing, scoped server-side to this seller's categories (see getMissedDemandForSeller.ts). */
export function useMissedDemand(sellerId: string | undefined) {
  return useQuery({
    queryKey: ['seller-missed-demand', sellerId],
    queryFn: async () => {
      const result = await getMissedDemandForSellerCallable({})
      return result.data.items
    },
    enabled: Boolean(sellerId),
    staleTime: 5 * 60_000,
  })
}
