import { searchMissSchema } from '@snapspare/shared'
import { addDoc, collection } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { SearchFilters } from '../types'

function toActiveFiltersRecord(filters: SearchFilters): Record<string, string | number | boolean> {
  const record: Record<string, string | number | boolean> = {}
  if (filters.brand.length) record.brand = filters.brand.join(',')
  if (filters.type.length) record.type = filters.type.join(',')
  if (filters.condition.length) record.condition = filters.condition.join(',')
  if (filters.sellerRatingMin) record.sellerRatingMin = filters.sellerRatingMin
  if (filters.warrantyMonthsMin) record.warrantyMonthsMin = filters.warrantyMonthsMin
  if (filters.inStockOnly) record.inStockOnly = true
  if (filters.fitsMyVehicle && filters.vehicleModelId) record.fitsMyVehicle = true
  if (filters.maxDeliveryEtaDays) record.maxDeliveryEtaDays = filters.maxDeliveryEtaDays
  return record
}

/**
 * Logs a zero-result query to `searchMisses` — the seller-acquisition /
 * catalogue-gap list (see firestore.rules for the shape-guarded, deliberately
 * signed-out-friendly create rule). Fire-and-forget: a logging failure must
 * never disrupt the buyer's zero-result experience, so callers don't await
 * rejection handling beyond a console warning.
 */
export async function logSearchMiss(params: {
  query: string
  filters: SearchFilters
  userId?: string
}): Promise<void> {
  const query = params.query.trim()
  if (!query) return

  const payload = searchMissSchema.omit({ id: true }).parse({
    query,
    normalizedQuery: query.toLowerCase(),
    activeFilters: toActiveFiltersRecord(params.filters),
    categorySlug: params.filters.category,
    vehicleModelId: params.filters.fitsMyVehicle ? params.filters.vehicleModelId : undefined,
    userId: params.userId,
    createdAt: Date.now(),
  })

  try {
    await addDoc(collection(db, 'searchMisses'), payload)
  } catch (error) {
    console.warn('logSearchMiss: failed to log zero-result query', error)
  }
}
