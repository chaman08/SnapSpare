import { z } from 'zod'
import { partConditionSchema, partTypeSchema } from '../enums'
import {
  listingIdSchema,
  partIdSchema,
  sellerIdSchema,
  vehicleMakeIdSchema,
  vehicleModelIdSchema,
} from '../ids'
import { paiseSchema } from '../types/money'
import { epochMsSchema } from './common'

/**
 * Mirrors search/searchCollectionSchema.ts field-for-field. This is the
 * runtime-validated shape of one Typesense document (id == listingId) — used
 * both server-side (buildSearchDocument's return type is checked against it
 * in tests) and client-side (search hooks parse hits through this before
 * handing them to ProductCard, so a stale/partially-synced document fails
 * loudly instead of rendering a broken card).
 */
export const searchListingDocumentSchema = z.object({
  id: z.string().min(1),
  listingId: listingIdSchema,
  partId: partIdSchema,
  sellerId: sellerIdSchema,
  sellerIds: z.array(sellerIdSchema).min(1),
  /** Denormalised seller business name — `sellers/{id}` is locked to the owning seller/admin (see firestore.rules), so this is the only way a buyer-facing page can show "sold by X" without a server round trip. */
  sellerName: z.string().default(''),
  title: z.string().min(1),
  brand: z.string().default(''),
  partNumber: z.string().default(''),
  oemNumbers: z.array(z.string()).default([]),
  crossRefNumbers: z.array(z.string()).default([]),
  category: z.string().min(1),
  subCategory: z.string().default(''),
  modelIds: z.array(vehicleModelIdSchema).default([]),
  makeIds: z.array(vehicleMakeIdSchema).default([]),
  type: partTypeSchema,
  condition: partConditionSchema,
  /** Unit price at the listing's MOQ — the headline price on the card. */
  basePricePaise: paiseSchema,
  /** Cheapest unit price across the pricing ladder (the deepest bulk tier) — the "from ₹X" slab hint. */
  minPricePaise: paiseSchema,
  /** minQty of the tier minPricePaise applies to, e.g. 20 for "from ₹1,040 at 20+". Absent when there's only one tier. */
  bulkMinQty: z.number().int().positive().optional(),
  mrpPaise: paiseSchema.optional(),
  maxRating: z.number().min(0).max(5).default(0),
  ratingCount: z.number().int().nonnegative().default(0),
  inStock: z.boolean(),
  stockQty: z.number().int().nonnegative(),
  moq: z.number().int().positive(),
  warrantyMonths: z.number().int().nonnegative().default(0),
  hasVerifiedFitment: z.boolean(),
  popularityScore: z.number().nonnegative().default(0),
  imageUrl: z.string().optional(),
  /**
   * Placeholder until Shiprocket serviceability/rate lookup is wired up
   * (Phase 5 has no per-pincode shipping data yet) — see
   * buildSearchDocument's doc comment for the heuristic used to fill this in.
   */
  deliveryEtaDays: z.number().int().positive().default(3),
  isFeatured: z.boolean().default(false),
  createdAt: epochMsSchema,
  updatedAt: epochMsSchema,
})
export type SearchListingDocument = z.infer<typeof searchListingDocumentSchema>

/**
 * Mirrors catalogPartSearchCollectionSchema.ts field-for-field — the
 * `catalog_parts` Typesense collection's document shape, id == partId. Only
 * used by the seller-facing "Add listing" typeahead; see
 * buildCatalogPartSearchDocument.ts.
 */
export const searchCatalogPartDocumentSchema = z.object({
  id: partIdSchema,
  partNumber: z.string().min(1),
  name: z.string().min(1),
  brand: z.string().default(''),
  oemNumbers: z.array(z.string()).default([]),
  crossRefNumbers: z.array(z.string()).default([]),
  categorySlug: z.string().min(1),
  subcategorySlug: z.string().default(''),
  hsnCode: z.string(),
  gstRatePercent: z.number(),
  imageUrl: z.string().optional(),
  createdAt: epochMsSchema,
})
export type SearchCatalogPartDocument = z.infer<typeof searchCatalogPartDocumentSchema>
