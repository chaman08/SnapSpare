import { z } from 'zod'
import { makeFirestoreConverter } from '../firestore/converter'
import { hsnSchema } from '../validators/indian'
import { epochMsSchema } from './common'
import { gstRatePercentSchema } from './catalogPart'

export const categoryIdSchema = z.string().min(1)
export type CategoryId = z.infer<typeof categoryIdSchema>

/**
 * Catalogue module (design brief item 3) — the category/subcategory master
 * list plus its HSN/GST mapping. `catalogPart.categorySlug`/`subcategorySlug`
 * were previously free text validated only client-side (see
 * `packages/shared/src/constants/categories.ts`); this collection is the
 * admin-editable source those slugs should now be checked against, though
 * existing free-text usage elsewhere is left untouched this phase.
 */
export const categorySchema = z.object({
  id: categoryIdSchema,
  slug: z.string().min(1),
  name: z.string().min(1),
  parentSlug: z.string().optional(),
  /** Default HSN/GST applied when a new catalogue part in this category doesn't specify its own — admin can always override per-part. */
  defaultHsnCode: hsnSchema.optional(),
  defaultGstRatePercent: gstRatePercentSchema.optional(),
  status: z.enum(['active', 'inactive']).default('active'),
  createdAt: epochMsSchema,
  updatedAt: epochMsSchema,
})
export type Category = z.infer<typeof categorySchema>

export const categoryConverter = makeFirestoreConverter(categorySchema)

export const saveCategoryRequestSchema = z.object({
  id: categoryIdSchema.optional(),
  slug: z.string().min(1),
  name: z.string().min(1),
  parentSlug: z.string().optional(),
  defaultHsnCode: hsnSchema.optional(),
  defaultGstRatePercent: gstRatePercentSchema.optional(),
  status: z.enum(['active', 'inactive']).default('active'),
})
export type SaveCategoryRequest = z.infer<typeof saveCategoryRequestSchema>

export const saveCategoryResultSchema = z.object({ id: categoryIdSchema })
export type SaveCategoryResult = z.infer<typeof saveCategoryResultSchema>
