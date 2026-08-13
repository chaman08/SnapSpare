import type { CatalogPart } from '../schemas/catalogPart'
import type { Listing } from '../schemas/listing'
import type { SearchListingDocument } from '../schemas/searchDocument'

export interface BuildSearchDocumentInput {
  listing: Listing
  part: CatalogPart
  sellerRatingAvg: number
  sellerRatingCount: number
  sellerName: string
  /** Resolves a vehicleModelId to its parent vehicleMakeId; return undefined for an unknown/stale id (skipped, not thrown). */
  resolveMakeId: (modelId: string) => string | undefined
}

/**
 * Pure mapping from Firestore state to one Typesense document — no Firestore
 * or Typesense SDK dependency, so it's usable identically from the Cloud
 * Function triggers (functions/src/search/) and the one-off backfill script
 * (packages/seed/src/scripts/backfillSearchIndex.ts) without either
 * reimplementing it.
 *
 * Returns `null` when the listing shouldn't be searchable (part inactive,
 * listing not active) — callers should delete the document with this id
 * from the index rather than upsert.
 */
export function buildSearchDocument({
  listing,
  part,
  sellerRatingAvg,
  sellerRatingCount,
  sellerName,
  resolveMakeId,
}: BuildSearchDocumentInput): SearchListingDocument | null {
  if (listing.status !== 'active' || part.status !== 'active') return null

  const tiers = listing.pricing.tiers
  const firstTier = tiers[0]
  const lastTier = tiers[tiers.length - 1]
  if (!firstTier || !lastTier) return null

  const modelIds = part.fitmentSummary.modelIds
  const makeIds = Array.from(
    new Set(modelIds.map((modelId) => resolveMakeId(modelId)).filter((id): id is string => Boolean(id))),
  )

  // No shipping/serviceability integration yet (see the schema field's
  // comment) — a small, deterministic placeholder so the ETA facet/sort has
  // something plausible to work with until Shiprocket rates are wired up.
  const deliveryEtaDays = listing.stockQty === 0 ? 7 : listing.stockQty < 5 ? 4 : 2

  const popularityScore = listing.viewCount + sellerRatingAvg * 20 + (listing.isFeatured ? 500 : 0)

  return {
    id: listing.id,
    listingId: listing.id,
    partId: part.id,
    sellerId: listing.sellerId,
    sellerIds: [listing.sellerId],
    sellerName,
    title: listing.title,
    brand: part.brand ?? '',
    partNumber: part.partNumber,
    oemNumbers: part.oemNumbers,
    crossRefNumbers: part.crossRefNumbers,
    category: part.categorySlug,
    subCategory: part.subcategorySlug ?? '',
    modelIds,
    makeIds,
    type: part.partType,
    condition: listing.condition,
    basePricePaise: firstTier.unitPricePaise,
    minPricePaise: lastTier.unitPricePaise,
    bulkMinQty: tiers.length > 1 ? lastTier.minQty : undefined,
    mrpPaise: listing.mrpPaise,
    maxRating: sellerRatingAvg,
    ratingCount: sellerRatingCount,
    inStock: listing.stockQty > 0,
    stockQty: listing.stockQty,
    moq: listing.pricing.moq,
    warrantyMonths: listing.warrantyMonths ?? 0,
    hasVerifiedFitment: modelIds.length > 0,
    popularityScore,
    imageUrl: listing.images[0] ?? part.images[0],
    deliveryEtaDays,
    isFeatured: listing.isFeatured,
    createdAt: listing.createdAt,
    updatedAt: listing.updatedAt,
  }
}
