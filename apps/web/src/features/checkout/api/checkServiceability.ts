import type { CheckServiceabilityRequest, CheckServiceabilityResult } from '@snapspare/shared'
import { useQuery } from '@tanstack/react-query'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/lib/firebase'

const checkServiceabilityCallable = httpsCallable<CheckServiceabilityRequest, CheckServiceabilityResult>(
  functions,
  'checkServiceability',
)

export async function checkServiceability(request: CheckServiceabilityRequest): Promise<CheckServiceabilityResult> {
  const result = await checkServiceabilityCallable(request)
  return result.data
}

/** Per-seller delivery serviceability + COD availability for the Delivery section — re-checked whenever the selected address changes, so a seller who can't ship to that pincode surfaces before payment, not after (design spec). */
export function useServiceability(args: CheckServiceabilityRequest | null) {
  return useQuery({
    queryKey: ['checkServiceability', args],
    queryFn: () => checkServiceability(args as CheckServiceabilityRequest),
    enabled: Boolean(args && args.sellerIds.length > 0),
    staleTime: 60_000,
    retry: 1,
  })
}
