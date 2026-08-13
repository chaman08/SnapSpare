import { type GetShippingRatesResult, getShippingRatesRequestSchema, sellerSchema } from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { getCachedOrFetchRates } from './rateCache.js'
import { resolveSellerOrigin } from './resolveSellerOrigin.js'
import { provider } from './provider.js'

/**
 * Serviceability + live courier rate check (design brief item 2), usable
 * from the product page (a single listing, before it's even in a cart),
 * the cart, and checkout — public (no auth) like priceCart, since a
 * signed-out browsing buyer should see the same delivery promise a
 * signed-in one does. Additive to (not a replacement for) the existing
 * `checkServiceability` (multi-seller, address-book-driven, still backing
 * DeliverySection.tsx) and `priceCart` (the authoritative zone-matrix
 * charge actually billed) — this is the provider-backed, cached preview
 * surface the design brief asks for.
 */
export const getShippingRates = onCall({ enforceAppCheck: true, region: 'asia-south1' }, async (request): Promise<GetShippingRatesResult> => {
  const parsed = getShippingRatesRequestSchema.safeParse(request.data)
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', 'A valid sellerId, destination pincode and weight are required')
  }
  const { sellerId, destPincode, weightGrams, dimensionsCm, codAmountPaise } = parsed.data

  const sellerSnapshot = await getFirestore().collection('sellers').doc(sellerId).get()
  if (!sellerSnapshot.exists) throw new HttpsError('not-found', 'seller_not_found')
  const seller = sellerSchema.parse({ id: sellerSnapshot.id, ...sellerSnapshot.data() })

  const origin = await resolveSellerOrigin(seller)
  if (!origin) return { serviceable: false, quotes: [] }

  const quotes = await getCachedOrFetchRates(origin.pincode, destPincode, weightGrams, () =>
    provider.getRates({
      originPincode: origin.pincode,
      destPincode,
      weightGrams,
      dimensionsCm,
      codAmountPaise,
    }),
  )

  return { serviceable: quotes.length > 0, quotes }
})
