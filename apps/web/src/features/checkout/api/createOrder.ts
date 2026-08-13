import type { CreateOrderRequest, CreateOrderResult } from '@snapspare/shared'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/lib/firebase'

const createOrderCallable = httpsCallable<CreateOrderRequest, CreateOrderResult>(functions, 'createOrder')

export async function createOrder(request: CreateOrderRequest): Promise<CreateOrderResult> {
  const result = await createOrderCallable(request)
  return result.data
}

/** Maps a createOrder failure to an i18n key under `checkout.errors.*` — mirrors mapPriceCartErrorToI18nKey's pattern, but keyed off the HttpsError *message* (createOrder throws a distinct reason string per failure) rather than just its status code. */
export function mapCreateOrderErrorToI18nKey(error: unknown): string {
  const message = (error as { message?: string } | null)?.message ?? ''
  switch (message) {
    case 'cart_empty':
      return 'checkout.errors.cartEmpty'
    case 'cart_changed':
      return 'checkout.errors.cartChanged'
    case 'insufficient_stock':
      return 'checkout.errors.insufficientStock'
    case 'cod_not_eligible':
      return 'checkout.errors.codNotEligible'
    case 'credit_not_eligible':
      return 'checkout.errors.creditNotEligible'
    case 'seller_unavailable':
      return 'checkout.errors.sellerUnavailable'
    case 'payment_gateway_unavailable':
      return 'checkout.errors.gatewayUnavailable'
    case 'shipping_address_not_found':
    case 'billing_address_not_found':
      return 'checkout.errors.addressNotFound'
    default:
      return 'checkout.errors.generic'
  }
}
