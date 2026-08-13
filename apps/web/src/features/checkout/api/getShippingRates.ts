import type { GetShippingRatesRequest, GetShippingRatesResult } from '@snapspare/shared'
import { useQuery } from '@tanstack/react-query'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/lib/firebase'

const getShippingRatesCallable = httpsCallable<GetShippingRatesRequest, GetShippingRatesResult>(
  functions,
  'getShippingRates',
)

export async function getShippingRates(request: GetShippingRatesRequest): Promise<GetShippingRatesResult> {
  const result = await getShippingRatesCallable(request)
  return result.data
}

/** Provider-backed, cached rate/serviceability preview for one seller — usable pre-cart (product page), in-cart, and at checkout. Distinct from useServiceability (checkServiceability.ts), which is the multi-seller, address-book-driven check DeliverySection uses. */
export function useShippingRates(args: GetShippingRatesRequest | null) {
  return useQuery({
    queryKey: ['getShippingRates', args],
    queryFn: () => getShippingRates(args as GetShippingRatesRequest),
    enabled: args !== null,
    staleTime: 5 * 60_000,
    retry: 1,
  })
}
