import { z } from 'zod'
import { partTypeSchema } from '../enums'
import { makeFirestoreConverter } from '../firestore/converter'
import { partIdSchema, vehicleModelIdSchema } from '../ids'
import { hsnSchema } from '../validators/indian'
import { epochMsSchema } from './common'

/** GST rate slabs actually in use in India. */
export const gstRatePercentSchema = z.union([
  z.literal(0),
  z.literal(5),
  z.literal(12),
  z.literal(18),
  z.literal(28),
])
export type GstRatePercent = z.infer<typeof gstRatePercentSchema>

/**
 * Denormalised roll-up of every vehicle model this part has a
 * `catalogFitments` row for. Kept in sync by the Cloud Function that writes
 * fitment rows (see functions/src/fitment/), so listing queries and the
 * Typesense search index can filter "parts for my model" without joining
 * against `catalogFitments` at read time.
 */
export const fitmentSummarySchema = z.object({
  modelIds: z.array(vehicleModelIdSchema).default([]),
})
export type FitmentSummary = z.infer<typeof fitmentSummarySchema>

/**
 * A master catalog part: the canonical, brand/seller-agnostic record for a
 * given part number. Sellers create `listings` against a `catalogPart`.
 */
export const catalogPartSchema = z.object({
  id: partIdSchema,
  partNumber: z.string().min(1),
  partType: partTypeSchema,
  categorySlug: z.string().min(1),
  subcategorySlug: z.string().optional(),
  name: z.string().min(1),
  /**
   * SEO URL slug (Phase 22), e.g. "bosch-brake-pad-set-fr". Set once at
   * create time (adminSaveCatalogPart.ts/bulkImportCatalogParts.ts) and
   * never rewritten on a later name edit, so a published product URL
   * (/parts/:partSlug-:partId) never rots. Optional because parts created
   * before Phase 22 don't have one yet — the product page falls back to
   * deriving one client-side from `name` (see seo/slugify.ts) until a
   * backfill runs; either way `partId` alone still resolves the page.
   */
  slug: z.string().min(1).optional(),
  description: z.string().optional(),
  brand: z.string().optional(),
  /** Manufacturer OEM part numbers this part matches — searched exactly first when a query looks like a part number (see search/partNumberQuery.ts). */
  oemNumbers: z.array(z.string().min(1)).default([]),
  /** Third-party/aftermarket cross-reference numbers for the same physical part. */
  crossRefNumbers: z.array(z.string().min(1)).default([]),
  hsnCode: hsnSchema,
  gstRatePercent: gstRatePercentSchema,
  /** Consumer Protection (E-Commerce) Rules, 2020, Rule 5(4) disclosure — shown on every product page. Defaults to 'India' since the overwhelming majority of this catalogue is domestically sourced/manufactured aftermarket parts; imported parts must be corrected at catalogue-entry time. */
  countryOfOrigin: z.string().min(1).default('India'),
  attributes: z.record(z.string(), z.string()).default({}),
  images: z.array(z.string().url()).default([]),
  fitmentSummary: fitmentSummarySchema.default({ modelIds: [] }),
  status: z.enum(['active', 'inactive']),
  /** Aggregated across every listing of this part — recomputed by functions/src/reviews/onReviewWrite.ts alongside the per-listing rating fields. */
  ratingAvg: z.number().min(0).max(5).default(0),
  ratingCount: z.number().int().nonnegative().default(0),
  ratingBayesian: z.number().min(0).max(5).default(0),
  /** All-time warranty claim count against this part number — incremented by functions/src/warranty/onWarrantyClaimWrite.ts. A demotion signal, not a hard gate — see warrantyClaimsLast90d for the more actionable trailing window. */
  warrantyClaimsCount: z.number().int().nonnegative().default(0),
  /** Trailing-90-day warranty claim count — the field seller/admin dashboards should actually sort/filter "which listings to demote" on, since warrantyClaimsCount never decays. */
  warrantyClaimsLast90d: z.number().int().nonnegative().default(0),
  createdAt: epochMsSchema,
  updatedAt: epochMsSchema,
})
export type CatalogPart = z.infer<typeof catalogPartSchema>

export const catalogPartConverter = makeFirestoreConverter(catalogPartSchema)

/**
 * Catalogue module (design brief item 3) admin create/update. `id` absent
 * means create. Duplicate-by-OEM-number detection (adminSaveCatalogPart.ts)
 * blocks a create whose `oemNumbers` overlap an existing active part unless
 * `allowDuplicate` is explicitly set — the same override flag
 * bulkImportCatalogParts.ts uses per-row.
 */
export const adminSaveCatalogPartRequestSchema = z.object({
  id: partIdSchema.optional(),
  partNumber: z.string().min(1),
  partType: partTypeSchema,
  categorySlug: z.string().min(1),
  subcategorySlug: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  brand: z.string().optional(),
  oemNumbers: z.array(z.string().min(1)).default([]),
  crossRefNumbers: z.array(z.string().min(1)).default([]),
  hsnCode: hsnSchema,
  gstRatePercent: gstRatePercentSchema,
  countryOfOrigin: z.string().min(1).default('India'),
  status: z.enum(['active', 'inactive']).default('active'),
  allowDuplicate: z.boolean().default(false),
})
export type AdminSaveCatalogPartRequest = z.infer<typeof adminSaveCatalogPartRequestSchema>

export const adminSaveCatalogPartResultSchema = z.object({
  id: partIdSchema,
  /** Other active parts sharing at least one OEM number — populated whether or not the save proceeded, so the UI can show "created, but note these possible duplicates" too. */
  duplicateOfPartIds: z.array(partIdSchema).default([]),
})
export type AdminSaveCatalogPartResult = z.infer<typeof adminSaveCatalogPartResultSchema>

/** One CSV row for the Catalogue bulk-import tool — see bulkImportCatalogParts.ts. Deliberately synchronous/small-batch (no Storage-upload job queue like the seller bulk-listing pattern) since this is a lower-volume admin/catalogue-team tool. */
export const catalogPartBulkImportRowSchema = z.object({
  rowNumber: z.number().int().positive(),
  partNumber: z.string().min(1),
  name: z.string().min(1),
  categorySlug: z.string().min(1),
  subcategorySlug: z.string().optional(),
  brand: z.string().optional(),
  hsnCode: hsnSchema,
  gstRatePercent: gstRatePercentSchema,
  /** Semicolon-joined in the CSV cell, split before validation. */
  oemNumbers: z.array(z.string().min(1)).default([]),
})
export type CatalogPartBulkImportRow = z.infer<typeof catalogPartBulkImportRowSchema>

export const bulkImportCatalogPartsRequestSchema = z.object({
  rows: z.array(catalogPartBulkImportRowSchema).min(1).max(500),
  /** false = validate/detect-duplicates only, nothing written. true = create every row that has no blocking error, skipping duplicates. */
  commit: z.boolean().default(false),
})
export type BulkImportCatalogPartsRequest = z.infer<typeof bulkImportCatalogPartsRequestSchema>

export const catalogPartBulkImportRowResultSchema = z.object({
  rowNumber: z.number().int().positive(),
  status: z.enum(['ok', 'duplicate', 'error']),
  message: z.string().optional(),
  duplicateOfPartIds: z.array(partIdSchema).default([]),
  createdPartId: partIdSchema.optional(),
})
export type CatalogPartBulkImportRowResult = z.infer<typeof catalogPartBulkImportRowResultSchema>

export const bulkImportCatalogPartsResultSchema = z.object({
  rows: z.array(catalogPartBulkImportRowResultSchema),
  createdCount: z.number().int().nonnegative(),
})
export type BulkImportCatalogPartsResult = z.infer<typeof bulkImportCatalogPartsResultSchema>
