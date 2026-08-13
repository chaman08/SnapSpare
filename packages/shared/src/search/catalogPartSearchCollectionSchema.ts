import type { TypesenseCollectionSchema } from './searchCollectionSchema'

export const CATALOG_PART_SEARCH_COLLECTION_NAME = 'catalog_parts'

/**
 * A second, independent Typesense collection from `SEARCH_COLLECTION_SCHEMA`
 * (which indexes `listings`, buyer-facing) — this one indexes `catalogParts`
 * directly, one document per master part, and exists solely to power the
 * seller-facing "Add listing" typeahead (search by part number/name/brand to
 * find the catalog part to attach commercial fields to). Deliberately not
 * merged into the listings pipeline: a catalog part with zero listings still
 * needs to be findable here, and the fan-out/debounce shape
 * (functions/src/search/catalogPartSearchQueue.ts,
 * processCatalogPartSearchIndexQueue.ts) mirrors searchIndexQueue.ts's
 * structure without sharing code, since the two pipelines key off different
 * source documents.
 */
export const CATALOG_PART_SEARCH_COLLECTION_SCHEMA: TypesenseCollectionSchema = {
  name: CATALOG_PART_SEARCH_COLLECTION_NAME,
  fields: [
    { name: 'partNumber', type: 'string' },
    { name: 'name', type: 'string' },
    { name: 'brand', type: 'string', optional: true, facet: true },
    { name: 'oemNumbers', type: 'string[]', optional: true },
    { name: 'crossRefNumbers', type: 'string[]', optional: true },
    { name: 'categorySlug', type: 'string', facet: true },
    { name: 'subcategorySlug', type: 'string', optional: true, facet: true },
    { name: 'hsnCode', type: 'string' },
    { name: 'gstRatePercent', type: 'int32' },
    { name: 'imageUrl', type: 'string', optional: true, index: false },
    { name: 'createdAt', type: 'int64', sort: true },
  ],
}
