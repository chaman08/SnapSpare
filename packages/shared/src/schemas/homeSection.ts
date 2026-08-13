import { z } from 'zod'
import { makeFirestoreConverter } from '../firestore/converter'
import { homeSectionIdSchema, listingIdSchema } from '../ids'
import { brandIdSchema } from './brand'
import { epochMsSchema } from './common'

/**
 * Growth module (Phase 20 design brief item 1) — the admin-configurable
 * homepage. Each doc is one rail/block; `sortOrder` (ascending) decides where
 * it lands on the page. `recently_viewed` and `reorder_rail` carry no
 * buyer-specific content here — their content is resolved per-buyer on the
 * client (localStorage / the buyer's own order history) — the admin doc only
 * controls whether the rail is shown, its position, and its title.
 */
export const homeSectionTypeSchema = z.enum([
  'hero_banner',
  'vehicle_selector',
  'category_tiles',
  'deal_of_day',
  'bulk_buy_spotlight',
  'brand_rail',
  'recently_viewed',
  'reorder_rail',
  'trust_strip',
])
export type HomeSectionType = z.infer<typeof homeSectionTypeSchema>

const i18nTextSchema = z.object({ en: z.string().min(1), hi: z.string().min(1) })

export const homeSectionTrustIconSchema = z.enum(['shield-check', 'file-check', 'rotate-ccw', 'banknote'])
export type HomeSectionTrustIcon = z.infer<typeof homeSectionTrustIconSchema>

const categoryTileItemSchema = z.object({
  categorySlug: z.string().min(1),
  label: i18nTextSchema,
  imageUrl: z.string().url(),
})
export type CategoryTileItem = z.infer<typeof categoryTileItemSchema>

const trustStripItemSchema = z.object({
  icon: homeSectionTrustIconSchema,
  label: i18nTextSchema,
})
export type TrustStripItem = z.infer<typeof trustStripItemSchema>

const baseFields = {
  id: homeSectionIdSchema,
  title: i18nTextSchema.optional(),
  subtitle: i18nTextSchema.optional(),
  sortOrder: z.number().int().default(0),
  status: z.enum(['active', 'inactive']).default('active'),
  createdAt: epochMsSchema,
  updatedAt: epochMsSchema,
}

export const homeSectionSchema = z.discriminatedUnion('type', [
  z.object({ ...baseFields, type: z.literal('hero_banner') }),
  z.object({ ...baseFields, type: z.literal('vehicle_selector') }),
  z.object({ ...baseFields, type: z.literal('category_tiles'), items: z.array(categoryTileItemSchema).min(1).max(12) }),
  z.object({
    ...baseFields,
    type: z.literal('deal_of_day'),
    listingId: listingIdSchema,
    startAt: epochMsSchema,
    endAt: epochMsSchema,
    badgeLabel: i18nTextSchema.optional(),
  }),
  z.object({
    ...baseFields,
    type: z.literal('bulk_buy_spotlight'),
    maxItems: z.number().int().positive().max(20).default(12),
    pinnedListingIds: z.array(listingIdSchema).max(20).default([]),
  }),
  z.object({ ...baseFields, type: z.literal('brand_rail'), brandIds: z.array(brandIdSchema).min(1).max(20) }),
  z.object({ ...baseFields, type: z.literal('recently_viewed'), maxItems: z.number().int().positive().max(20).default(10) }),
  z.object({ ...baseFields, type: z.literal('reorder_rail'), maxItems: z.number().int().positive().max(20).default(5) }),
  z.object({ ...baseFields, type: z.literal('trust_strip'), items: z.array(trustStripItemSchema).min(1).max(6) }),
])
export type HomeSection = z.infer<typeof homeSectionSchema>

export const homeSectionConverter = makeFirestoreConverter(homeSectionSchema)

const baseRequestFields = {
  id: homeSectionIdSchema.optional(),
  title: i18nTextSchema.optional(),
  subtitle: i18nTextSchema.optional(),
  sortOrder: z.number().int().default(0),
  status: z.enum(['active', 'inactive']).default('active'),
}

export const saveHomeSectionRequestSchema = z
  .discriminatedUnion('type', [
    z.object({ ...baseRequestFields, type: z.literal('hero_banner') }),
    z.object({ ...baseRequestFields, type: z.literal('vehicle_selector') }),
    z.object({ ...baseRequestFields, type: z.literal('category_tiles'), items: z.array(categoryTileItemSchema).min(1).max(12) }),
    z.object({
      ...baseRequestFields,
      type: z.literal('deal_of_day'),
      listingId: listingIdSchema,
      startAt: epochMsSchema,
      endAt: epochMsSchema,
      badgeLabel: i18nTextSchema.optional(),
    }),
    z.object({
      ...baseRequestFields,
      type: z.literal('bulk_buy_spotlight'),
      maxItems: z.number().int().positive().max(20).default(12),
      pinnedListingIds: z.array(listingIdSchema).max(20).default([]),
    }),
    z.object({ ...baseRequestFields, type: z.literal('brand_rail'), brandIds: z.array(brandIdSchema).min(1).max(20) }),
    z.object({ ...baseRequestFields, type: z.literal('recently_viewed'), maxItems: z.number().int().positive().max(20).default(10) }),
    z.object({ ...baseRequestFields, type: z.literal('reorder_rail'), maxItems: z.number().int().positive().max(20).default(5) }),
    z.object({ ...baseRequestFields, type: z.literal('trust_strip'), items: z.array(trustStripItemSchema).min(1).max(6) }),
  ])
  .refine((value) => value.type !== 'deal_of_day' || value.endAt > value.startAt, {
    message: 'endAt must be after startAt',
    path: ['endAt'],
  })
export type SaveHomeSectionRequest = z.infer<typeof saveHomeSectionRequestSchema>

export const saveHomeSectionResultSchema = z.object({ id: homeSectionIdSchema })
export type SaveHomeSectionResult = z.infer<typeof saveHomeSectionResultSchema>

export const reorderHomeSectionsRequestSchema = z.object({
  orderedIds: z.array(homeSectionIdSchema).min(1).max(50),
})
export type ReorderHomeSectionsRequest = z.infer<typeof reorderHomeSectionsRequestSchema>

export const reorderHomeSectionsResultSchema = z.object({ updated: z.number().int().nonnegative() })
export type ReorderHomeSectionsResult = z.infer<typeof reorderHomeSectionsResultSchema>
