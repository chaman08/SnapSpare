import type { CatalogPart } from '../schemas/catalogPart'
import type { SearchCatalogPartDocument } from '../schemas/searchDocument'

/**
 * Pure mapping from a `CatalogPart` to one `catalog_parts` Typesense
 * document — parallels `buildSearchDocument.ts`'s shape without importing
 * from it, since the two pipelines key off different source documents (see
 * `catalogPartSearchCollectionSchema.ts`'s header comment). Returns `null`
 * for an inactive part; callers should delete that id from the index rather
 * than upsert.
 */
export function buildCatalogPartSearchDocument(part: CatalogPart): SearchCatalogPartDocument | null {
  if (part.status !== 'active') return null

  return {
    id: part.id,
    partNumber: part.partNumber,
    name: part.name,
    brand: part.brand ?? '',
    oemNumbers: part.oemNumbers,
    crossRefNumbers: part.crossRefNumbers,
    categorySlug: part.categorySlug,
    subcategorySlug: part.subcategorySlug ?? '',
    hsnCode: part.hsnCode,
    gstRatePercent: part.gstRatePercent,
    imageUrl: part.images[0],
    createdAt: part.createdAt,
  }
}
