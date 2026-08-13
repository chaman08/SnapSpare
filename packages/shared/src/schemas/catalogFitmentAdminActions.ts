import { z } from 'zod'
import { catalogFitmentIdSchema, partIdSchema, vehicleMakeIdSchema, vehicleModelIdSchema, vehicleVariantIdSchema } from '../ids'
import { fuelTypeSchema } from './vehicleVariant'

/**
 * Fitment workbench (design brief item 4) create/edit/verify. `id` absent
 * means create. Conflict detection (adminSaveCatalogFitment.ts) is scoped
 * to an exact duplicate `{partId, makeId, modelId, variantId}` tuple — the
 * schema has no notion of an "exclusive fitment position" a part could
 * contest (multiple compatible parts legitimately share a vehicle), so this
 * is the practical, honestly-documented interpretation: it catches
 * accidental double-entry of the same mapping, not a business-rule
 * exclusivity conflict.
 */
export const adminSaveCatalogFitmentRequestSchema = z.object({
  id: catalogFitmentIdSchema.optional(),
  partId: partIdSchema,
  makeId: vehicleMakeIdSchema,
  modelId: vehicleModelIdSchema,
  variantId: vehicleVariantIdSchema.optional(),
  fuelTypes: z.array(fuelTypeSchema).min(1).optional(),
  yearFrom: z.number().int().min(1980).max(2100).optional(),
  yearTo: z.number().int().min(1980).max(2100).optional(),
  notes: z.string().optional(),
  /** Marks the row verified by this admin at save time — verify-only edits (no field changes) still go through this same callable. */
  verify: z.boolean().default(false),
  allowConflict: z.boolean().default(false),
})
export type AdminSaveCatalogFitmentRequest = z.infer<typeof adminSaveCatalogFitmentRequestSchema>

export const adminSaveCatalogFitmentResultSchema = z.object({
  id: catalogFitmentIdSchema,
  conflictingFitmentIds: z.array(catalogFitmentIdSchema).default([]),
})
export type AdminSaveCatalogFitmentResult = z.infer<typeof adminSaveCatalogFitmentResultSchema>

export const catalogFitmentBulkImportRowSchema = z.object({
  rowNumber: z.number().int().positive(),
  partId: partIdSchema,
  makeId: vehicleMakeIdSchema,
  modelId: vehicleModelIdSchema,
  variantId: vehicleVariantIdSchema.optional(),
  yearFrom: z.number().int().min(1980).max(2100).optional(),
  yearTo: z.number().int().min(1980).max(2100).optional(),
  notes: z.string().optional(),
})
export type CatalogFitmentBulkImportRow = z.infer<typeof catalogFitmentBulkImportRowSchema>

export const bulkImportCatalogFitmentsRequestSchema = z.object({
  rows: z.array(catalogFitmentBulkImportRowSchema).min(1).max(500),
  commit: z.boolean().default(false),
})
export type BulkImportCatalogFitmentsRequest = z.infer<typeof bulkImportCatalogFitmentsRequestSchema>

export const catalogFitmentBulkImportRowResultSchema = z.object({
  rowNumber: z.number().int().positive(),
  status: z.enum(['ok', 'conflict', 'error']),
  message: z.string().optional(),
  createdFitmentId: catalogFitmentIdSchema.optional(),
})
export type CatalogFitmentBulkImportRowResult = z.infer<typeof catalogFitmentBulkImportRowResultSchema>

export const bulkImportCatalogFitmentsResultSchema = z.object({
  rows: z.array(catalogFitmentBulkImportRowResultSchema),
  createdCount: z.number().int().nonnegative(),
})
export type BulkImportCatalogFitmentsResult = z.infer<typeof bulkImportCatalogFitmentsResultSchema>
