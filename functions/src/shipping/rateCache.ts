import type { RateQuote } from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'

const CACHE_TTL_MS = 30 * 60_000
/** Nearby cart weights share one cache entry — a 3.4kg and a 3.6kg shipment both round up to the same 3.5kg slab. */
const WEIGHT_SLAB_GRAMS = 500

interface RateCacheDoc {
  quotes: RateQuote[]
  expiresAt: number
}

function cacheKey(originPincode: string, destPincode: string, weightGrams: number): string {
  const weightSlab = Math.ceil(weightGrams / WEIGHT_SLAB_GRAMS) * WEIGHT_SLAB_GRAMS
  return `${originPincode}_${destPincode}_${weightSlab}`
}

/**
 * Short-lived cache for provider rate quotes, keyed by
 * `(originPincode, destPincode, weightSlab)` per the design brief — a
 * product-page rate check and a cart pricing pass for the same
 * route/weight within the TTL window hit Firestore instead of the
 * (rate-limited, latency-costly) courier API. Closed to client read/write
 * in firestore.rules, same as `idempotencyKeys`.
 */
export async function getCachedOrFetchRates(
  originPincode: string,
  destPincode: string,
  weightGrams: number,
  fetchFn: () => Promise<RateQuote[]>,
): Promise<RateQuote[]> {
  const db = getFirestore()
  const ref = db.collection('shippingRateCache').doc(cacheKey(originPincode, destPincode, weightGrams))

  const snapshot = await ref.get()
  if (snapshot.exists) {
    const cached = snapshot.data() as RateCacheDoc
    if (cached.expiresAt > Date.now()) return cached.quotes
  }

  const quotes = await fetchFn()
  await ref.set({ quotes, expiresAt: Date.now() + CACHE_TTL_MS } satisfies RateCacheDoc)
  return quotes
}
