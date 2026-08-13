import { z } from 'zod'
import { makeFirestoreConverter } from '../firestore/converter'
import { epochMsSchema } from './common'

export const brandIdSchema = z.string().min(1)
export type BrandId = z.infer<typeof brandIdSchema>

/** Catalogue module (design brief item 3) — the brand master list, previously only a free-text `catalogPart.brand` field. Existing free-text values are left as-is; this collection is additive, not a migration. */
export const brandSchema = z.object({
  id: brandIdSchema,
  name: z.string().min(1),
  slug: z.string().min(1),
  logoUrl: z.string().url().optional(),
  /** Brands requiring a verified brandAuthorization doc before a seller's listing earns the "Genuine part" badge — informational flag for the catalogue team, not itself enforced anywhere (onBrandAuthorizationWrite.ts already gates the badge per-listing). */
  authorizedOnly: z.boolean().default(false),
  status: z.enum(['active', 'inactive']).default('active'),
  createdAt: epochMsSchema,
  updatedAt: epochMsSchema,
})
export type Brand = z.infer<typeof brandSchema>

export const brandConverter = makeFirestoreConverter(brandSchema)

export const saveBrandRequestSchema = z.object({
  id: brandIdSchema.optional(),
  name: z.string().min(1),
  slug: z.string().min(1),
  logoUrl: z.string().url().optional(),
  authorizedOnly: z.boolean().default(false),
  status: z.enum(['active', 'inactive']).default('active'),
})
export type SaveBrandRequest = z.infer<typeof saveBrandRequestSchema>

export const saveBrandResultSchema = z.object({ id: brandIdSchema })
export type SaveBrandResult = z.infer<typeof saveBrandResultSchema>
