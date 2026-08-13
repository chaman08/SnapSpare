import { z } from 'zod'
import { makeFirestoreConverter } from '../firestore/converter'
import { epochMsSchema } from './common'

export const bannerIdSchema = z.string().min(1)
export type BannerId = z.infer<typeof bannerIdSchema>

/** Marketing module (design brief item 9) — a homepage/merchandising banner slot. `slot` groups banners competing for the same placement; within a slot, `sortOrder` (ascending) breaks ties when more than one is active at once. */
export const bannerSlotSchema = z.enum(['home_hero', 'home_secondary', 'category_top'])
export type BannerSlot = z.infer<typeof bannerSlotSchema>

export const bannerSchema = z.object({
  id: bannerIdSchema,
  slot: bannerSlotSchema,
  imageUrl: z.string().url(),
  linkUrl: z.string().optional(),
  title: z.object({ en: z.string(), hi: z.string() }).optional(),
  sortOrder: z.number().int().default(0),
  startAt: epochMsSchema,
  endAt: epochMsSchema,
  status: z.enum(['active', 'inactive']).default('active'),
  createdAt: epochMsSchema,
  updatedAt: epochMsSchema,
})
export type Banner = z.infer<typeof bannerSchema>

export const bannerConverter = makeFirestoreConverter(bannerSchema)

export const saveBannerRequestSchema = z
  .object({
    id: bannerIdSchema.optional(),
    slot: bannerSlotSchema,
    imageUrl: z.string().url(),
    linkUrl: z.string().optional(),
    title: z.object({ en: z.string(), hi: z.string() }).optional(),
    sortOrder: z.number().int().default(0),
    startAt: epochMsSchema,
    endAt: epochMsSchema,
    status: z.enum(['active', 'inactive']).default('active'),
  })
  .refine((value) => value.endAt > value.startAt, { message: 'endAt must be after startAt', path: ['endAt'] })
export type SaveBannerRequest = z.infer<typeof saveBannerRequestSchema>

export const saveBannerResultSchema = z.object({ id: bannerIdSchema })
export type SaveBannerResult = z.infer<typeof saveBannerResultSchema>
