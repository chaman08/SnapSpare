import type { BuyerType, PriceCartRequest, PriceCartResult } from '@snapspare/shared'
import { useQuery } from '@tanstack/react-query'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/lib/firebase'

const priceCartCallable = httpsCallable<PriceCartRequest, PriceCartResult>(functions, 'priceCart')

export async function priceCart(request: PriceCartRequest): Promise<PriceCartResult> {
  const result = await priceCartCallable(request)
  return result.data
}

/** Maps a priceCart failure to an i18n key under `cart.errors.*` — mirrors mapVehicleRegLookupErrorToI18nKey's switch pattern. */
export function mapPriceCartErrorToI18nKey(error: unknown): string {
  const code = (error as { code?: string } | null)?.code ?? ''
  switch (code) {
    case 'functions/invalid-argument':
      return 'cart.errors.invalid'
    default:
      return 'cart.errors.pricingFailed'
  }
}

export interface UsePriceCartArgs {
  items: Array<{
    listingId: string
    qty: number
    snapshotUnitPricePaise?: number
    snapshotTierMinQtyApplied?: number
  }>
  couponCode?: string
  pincode?: string
  buyerType?: BuyerType
}

/**
 * The cart page's single call to the server-authoritative pricing function
 * (design spec item 2) — re-fetched whenever the items/coupon/pincode/buyer
 * type change. Never staled indefinitely (`staleTime: 0`) since a sibling
 * tab or another device could change stock/price between renders, and the
 * whole point of this endpoint is that the client never trusts an old total.
 */
export function usePriceCart(args: UsePriceCartArgs | null) {
  return useQuery({
    queryKey: ['priceCart', args],
    queryFn: () => priceCart(args as PriceCartRequest),
    enabled: Boolean(args && args.items.length > 0),
    staleTime: 0,
    retry: 1,
  })
}
