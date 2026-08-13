import { type BulkPriceChangeResult, bulkPriceChangeRequestSchema, catalogPartSchema } from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { applyPricingPatch } from './persistListing.js'
import { requireSellerPermission } from '../seller/staffAuthz.js'

const CHUNK_SIZE = 30 // Firestore 'in' query limit

function applyShift(unitPricePaise: number, mode: 'percent' | 'absolute', value: number): number {
  const shifted = mode === 'percent' ? Math.round(unitPricePaise * (1 + value / 100)) : unitPricePaise + value
  return Math.max(0, shifted)
}

/**
 * manage_listings-gated bulk price change by category or brand (requirement
 * 4) — `brand`/`categorySlug` live on `catalogPart`, not `listing`, so this
 * resolves matching parts first, then this seller's listings against those
 * parts. Each listing's full tier ladder gets the same percent/absolute
 * shift and is re-validated via `applyPricingPatch` (the same primitive
 * `applyPricingTemplate` uses) — a shift can break the strictly-descending-
 * price invariant at boundary tiers, so this isn't a blind field write; a
 * listing that would end up invalid is skipped and reported, not partially
 * applied.
 */
export const bulkPriceChange = onCall(
  { enforceAppCheck: true, region: 'asia-south1', timeoutSeconds: 120 },
  async (request): Promise<BulkPriceChangeResult> => {
    const sellerId = requireSellerPermission(request, 'manage_listings')

    const parsed = bulkPriceChangeRequestSchema.safeParse(request.data)
    if (!parsed.success) throw new HttpsError('invalid-argument', parsed.error.issues[0]?.message ?? 'invalid_request')
    const { scope, mode, value } = parsed.data

    const db = getFirestore()

    const partsQuery = scope.categorySlug
      ? db.collection('catalogParts').where('categorySlug', '==', scope.categorySlug)
      : db.collection('catalogParts').where('brand', '==', scope.brand)
    const partsSnapshot = await partsQuery.get()
    const partIds = partsSnapshot.docs
      .map((doc) => catalogPartSchema.safeParse({ id: doc.id, ...doc.data() }))
      .filter((r) => r.success)
      .map((r) => r.data.id)

    if (partIds.length === 0) return { updatedListingIds: [], failedListingIds: [] }

    const listingIds = new Set<string>()
    for (let i = 0; i < partIds.length; i += CHUNK_SIZE) {
      const chunk = partIds.slice(i, i + CHUNK_SIZE)
      const listingsSnapshot = await db
        .collection('listings')
        .where('sellerId', '==', sellerId)
        .where('partId', 'in', chunk)
        .get()
      for (const doc of listingsSnapshot.docs) listingIds.add(doc.id)
    }

    const updatedListingIds: string[] = []
    const failedListingIds: string[] = []

    for (const listingId of listingIds) {
      try {
        const snapshot = await db.collection('listings').doc(listingId).get()
        const data = snapshot.data()
        if (!data) throw new Error('missing')
        const tiers = (data.pricing.tiers as { minQty: number; maxQty: number | null; unitPricePaise: number }[]).map((tier) => ({
          ...tier,
          unitPricePaise: applyShift(tier.unitPricePaise, mode, value),
        }))
        await applyPricingPatch({
          sellerId,
          listingId,
          pricing: { moq: data.pricing.moq, stepQty: data.pricing.stepQty, tiers },
        })
        updatedListingIds.push(listingId)
      } catch {
        failedListingIds.push(listingId)
      }
    }

    return { updatedListingIds, failedListingIds }
  },
)
