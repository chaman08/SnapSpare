import { z } from 'zod'
import { makeFirestoreConverter } from '../firestore/converter'
import { epochMsSchema } from './common'

export const cmsPageIdSchema = z.string().min(1)
export type CmsPageId = z.infer<typeof cmsPageIdSchema>

export const cmsPageTypeSchema = z.enum(['policy', 'faq', 'seo_landing'])
export type CmsPageType = z.infer<typeof cmsPageTypeSchema>

const bilingualTextSchema = z.object({ en: z.string(), hi: z.string() })

/** Content module (design brief item 10): policy pages, FAQ entries, and SEO landing pages, all sharing one CMS shape. `body` is stored as plain text/markdown, not sanitized rich HTML — the storefront renderer is responsible for safe rendering (never `dangerouslySetInnerHTML` straight from this field). */
export const cmsPageSchema = z.object({
  id: cmsPageIdSchema,
  slug: z.string().min(1),
  type: cmsPageTypeSchema,
  title: bilingualTextSchema,
  body: bilingualTextSchema,
  metaDescription: bilingualTextSchema.optional(),
  status: z.enum(['draft', 'published']).default('draft'),
  createdAt: epochMsSchema,
  updatedAt: epochMsSchema,
})
export type CmsPage = z.infer<typeof cmsPageSchema>

export const cmsPageConverter = makeFirestoreConverter(cmsPageSchema)

export const saveCmsPageRequestSchema = z.object({
  id: cmsPageIdSchema.optional(),
  slug: z.string().min(1),
  type: cmsPageTypeSchema,
  title: bilingualTextSchema,
  body: bilingualTextSchema,
  metaDescription: bilingualTextSchema.optional(),
  status: z.enum(['draft', 'published']).default('draft'),
})
export type SaveCmsPageRequest = z.infer<typeof saveCmsPageRequestSchema>

export const saveCmsPageResultSchema = z.object({ id: cmsPageIdSchema })
export type SaveCmsPageResult = z.infer<typeof saveCmsPageResultSchema>
