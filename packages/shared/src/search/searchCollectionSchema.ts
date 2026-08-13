/**
 * Deliberately not typed against the `typesense` package: this needs to be
 * importable from `packages/shared` (which stays dependency-free of any
 * particular search/DB SDK, same rationale as firestore/converter.ts) as
 * well as from functions/ and packages/seed, which each depend on
 * `typesense` themselves and pass this straight into
 * `client.collections().create(...)`.
 */
export interface TypesenseFieldSchema {
  name: string
  type: 'string' | 'string[]' | 'bool' | 'int32' | 'int64' | 'float'
  facet?: boolean
  optional?: boolean
  /** Sortable numeric/bool field. */
  sort?: boolean
  /** false = stored but not searchable/filterable (e.g. an image URL). */
  index?: boolean
}

export interface TypesenseCollectionSchema {
  name: string
  fields: TypesenseFieldSchema[]
  default_sorting_field?: string
}

export const SEARCH_COLLECTION_NAME = 'listings'

/**
 * One document per active listing (not per catalog part) — a search result
 * card maps 1:1 onto a single seller's stock/price/rating, which is what
 * ProductCard renders. `sellerIds`/`modelIds`/`makeIds` are arrays even
 * though a listing has exactly one seller, so all three facet fields share
 * the same array-facet shape in Typesense and in FacetSidebar's filter code.
 * See packages/shared/src/search/buildSearchDocument.ts for how a document
 * is derived from a Listing + CatalogPart + Seller.
 */
export const SEARCH_COLLECTION_SCHEMA: TypesenseCollectionSchema = {
  name: SEARCH_COLLECTION_NAME,
  fields: [
    { name: 'title', type: 'string' },
    { name: 'brand', type: 'string', facet: true, optional: true },
    { name: 'partNumber', type: 'string', optional: true },
    { name: 'oemNumbers', type: 'string[]', optional: true },
    { name: 'crossRefNumbers', type: 'string[]', optional: true },
    { name: 'category', type: 'string', facet: true },
    { name: 'subCategory', type: 'string', facet: true, optional: true },
    { name: 'modelIds', type: 'string[]', facet: true, optional: true },
    { name: 'makeIds', type: 'string[]', facet: true, optional: true },
    { name: 'type', type: 'string', facet: true },
    { name: 'condition', type: 'string', facet: true },
    { name: 'basePricePaise', type: 'int64', sort: true },
    { name: 'minPricePaise', type: 'int64', sort: true },
    { name: 'bulkMinQty', type: 'int32', optional: true },
    { name: 'mrpPaise', type: 'int64', optional: true },
    { name: 'maxRating', type: 'float', facet: true, sort: true },
    { name: 'ratingCount', type: 'int32', optional: true },
    { name: 'inStock', type: 'bool', facet: true },
    { name: 'stockQty', type: 'int32' },
    { name: 'moq', type: 'int32' },
    { name: 'warrantyMonths', type: 'int32', facet: true },
    { name: 'hasVerifiedFitment', type: 'bool', facet: true },
    { name: 'popularityScore', type: 'float', sort: true },
    { name: 'imageUrl', type: 'string', optional: true, index: false },
    { name: 'deliveryEtaDays', type: 'int32', facet: true, sort: true },
    { name: 'isFeatured', type: 'bool', facet: true },
    { name: 'sellerId', type: 'string', facet: true },
    { name: 'sellerIds', type: 'string[]', facet: true },
    { name: 'sellerName', type: 'string', optional: true },
    { name: 'partId', type: 'string' },
    { name: 'listingId', type: 'string' },
    { name: 'createdAt', type: 'int64', sort: true },
    { name: 'updatedAt', type: 'int64', sort: true },
  ],
  default_sorting_field: 'popularityScore',
}
