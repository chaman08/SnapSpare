import { z } from 'zod'
import { makeFirestoreConverter } from '../firestore/converter'
import { listingIdSchema, sellerIdSchema } from '../ids'
import { callableRequestSchema, epochMsSchema } from './common'

export const bulkUploadJobIdSchema = z.string().min(1)
export type BulkUploadJobId = z.infer<typeof bulkUploadJobIdSchema>

export const bulkUploadRowResultSchema = z.object({
  rowNumber: z.number().int().positive(),
  sku: z.string().optional(),
  valid: z.boolean(),
  /** Plain-language reasons, not raw zod issue text — see tierErrorMessages.ts's mapping approach reused for pricing-shaped rows. */
  errors: z.array(z.string()).default([]),
  /** Set once commitBulkListingUpload.ts actually writes this row. */
  listingId: listingIdSchema.optional(),
})
export type BulkUploadRowResult = z.infer<typeof bulkUploadRowResultSchema>

export const bulkUploadJobStatusSchema = z.enum(['parsing', 'ready_for_review', 'committing', 'committed', 'failed'])
export type BulkUploadJobStatus = z.infer<typeof bulkUploadJobStatusSchema>

/**
 * One row per bulk-upload attempt (requirement 4). `rows` holds every
 * parsed row's validation outcome so the client can render a
 * preview-before-commit table without a second round trip; capped at
 * `MAX_BULK_UPLOAD_ROWS` per job so this stays a single reasonably-sized
 * document rather than needing its own subcollection.
 */
export const bulkUploadJobSchema = z.object({
  id: bulkUploadJobIdSchema,
  sellerId: sellerIdSchema,
  status: bulkUploadJobStatusSchema,
  sourceStoragePath: z.string().min(1),
  errorReportStoragePath: z.string().optional(),
  totalRows: z.number().int().nonnegative().default(0),
  validRows: z.number().int().nonnegative().default(0),
  invalidRows: z.number().int().nonnegative().default(0),
  committedRows: z.number().int().nonnegative().default(0),
  rows: z.array(bulkUploadRowResultSchema).default([]),
  createdAt: epochMsSchema,
  updatedAt: epochMsSchema,
})
export type BulkUploadJob = z.infer<typeof bulkUploadJobSchema>
export const bulkUploadJobConverter = makeFirestoreConverter(bulkUploadJobSchema)

export const MAX_BULK_UPLOAD_ROWS = 500

/**
 * Column contract shared by the client's template generator
 * (bulkUploadTemplate.ts) and the server-side parser
 * (parseBulkListingUpload.ts) — both must agree on header text and column
 * order, or an uploaded sheet based on the downloaded template won't parse.
 * Deliberately supports only up to 3 tiers (moq-anchored tier 1, optional
 * tier 2, optional open-ended tier 3) — a full multi-group buyer-pricing
 * ladder isn't representable in flat spreadsheet columns without becoming
 * unreadable; rolling out a richer shape across many listings is what
 * pricing templates + "apply to many" (M4's applyPricingTemplate) are for.
 * Bulk upload's job is fast catalogue-wide onboarding, not ladder authoring.
 */
export const BULK_UPLOAD_COLUMNS = [
  { key: 'partNumber', header: 'Part Number (must exist in catalogue)*', required: true },
  { key: 'sku', header: 'Your SKU*', required: true },
  { key: 'condition', header: 'Condition (new/used/refurbished)*', required: true },
  { key: 'stockQty', header: 'Stock Qty*', required: true },
  { key: 'moq', header: 'MOQ*', required: true },
  { key: 'stepQty', header: 'Step Qty (default 1)', required: false },
  { key: 'tier1MaxQty', header: 'Tier 1 Ends At (blank = single tier)', required: false },
  { key: 'tier1UnitPriceRupees', header: 'Tier 1 Price (Rupees)*', required: true },
  { key: 'tier2MaxQty', header: 'Tier 2 Ends At', required: false },
  { key: 'tier2UnitPriceRupees', header: 'Tier 2 Price (Rupees)', required: false },
  { key: 'tier3UnitPriceRupees', header: 'Tier 3 Price (Rupees, open-ended)', required: false },
  { key: 'mrpRupees', header: 'MRP (Rupees)', required: false },
  { key: 'taxIncluded', header: 'Prices Include GST (TRUE/FALSE)*', required: true },
  { key: 'hsnCode', header: 'HSN Code (blank = use catalogue default)', required: false },
  { key: 'gstRatePercent', header: 'GST Rate % (blank = use catalogue default)', required: false },
  { key: 'weightGrams', header: 'Weight (grams)', required: false },
  { key: 'warrantyMonths', header: 'Warranty (months)', required: false },
  { key: 'isOversized', header: 'Oversized (TRUE/FALSE)', required: false },
] as const

export type BulkUploadColumnKey = (typeof BULK_UPLOAD_COLUMNS)[number]['key']

export const parseBulkListingUploadRequestSchema = z.object({
  storagePath: z.string().min(1),
})
export type ParseBulkListingUploadRequest = z.infer<typeof parseBulkListingUploadRequestSchema>

export const parseBulkListingUploadResultSchema = z.object({
  jobId: bulkUploadJobIdSchema,
  totalRows: z.number().int().nonnegative(),
  validRows: z.number().int().nonnegative(),
  invalidRows: z.number().int().nonnegative(),
})
export type ParseBulkListingUploadResult = z.infer<typeof parseBulkListingUploadResultSchema>

export const commitBulkListingUploadRequestSchema = z.object({
  jobId: bulkUploadJobIdSchema,
})
export type CommitBulkListingUploadRequest = z.infer<typeof commitBulkListingUploadRequestSchema>

export const commitBulkListingUploadResultSchema = z.object({
  committedRows: z.number().int().nonnegative(),
  errorReportStoragePath: z.string().optional(),
})
export type CommitBulkListingUploadResult = z.infer<typeof commitBulkListingUploadResultSchema>

const bulkScopeSchema = z
  .object({
    categorySlug: z.string().min(1).optional(),
    brand: z.string().min(1).optional(),
  })
  .refine((v) => Boolean(v.categorySlug) !== Boolean(v.brand), 'Exactly one of categorySlug or brand must be set')

export const bulkPriceChangeRequestSchema = callableRequestSchema(
  z.object({
    scope: bulkScopeSchema,
    mode: z.enum(['percent', 'absolute']),
    /** Percent: -100..100 (negative = discount). Absolute: paise delta, may be negative. */
    value: z.number(),
  }),
)
export type BulkPriceChangeRequest = z.infer<typeof bulkPriceChangeRequestSchema>

export const bulkPriceChangeResultSchema = z.object({
  updatedListingIds: z.array(listingIdSchema),
  failedListingIds: z.array(listingIdSchema),
})
export type BulkPriceChangeResult = z.infer<typeof bulkPriceChangeResultSchema>

export const bulkStockUpdateRequestSchema = callableRequestSchema(
  z.object({
    listingIds: z.array(listingIdSchema).min(1).max(400),
    mode: z.enum(['set', 'delta']),
    value: z.number().int(),
  }),
)
export type BulkStockUpdateRequest = z.infer<typeof bulkStockUpdateRequestSchema>

export const bulkStockUpdateResultSchema = z.object({
  updatedListingIds: z.array(listingIdSchema),
  failedListingIds: z.array(listingIdSchema),
})
export type BulkStockUpdateResult = z.infer<typeof bulkStockUpdateResultSchema>

export const bulkStatusChangeRequestSchema = callableRequestSchema(
  z.object({
    listingIds: z.array(listingIdSchema).min(1).max(400),
    status: z.enum(['active', 'paused', 'archived']),
  }),
)
export type BulkStatusChangeRequest = z.infer<typeof bulkStatusChangeRequestSchema>

export const bulkStatusChangeResultSchema = z.object({
  updatedListingIds: z.array(listingIdSchema),
  failedListingIds: z.array(listingIdSchema),
})
export type BulkStatusChangeResult = z.infer<typeof bulkStatusChangeResultSchema>
