import { z } from 'zod'
import { makeFirestoreConverter } from '../firestore/converter'
import { epochMsSchema } from './common'

export const sitemapUrlEntrySchema = z.object({
  loc: z.string().min(1),
  lastmod: epochMsSchema.optional(),
})
export type SitemapUrlEntry = z.infer<typeof sitemapUrlEntrySchema>

/**
 * One shard of pre-rendered sitemap URLs (Phase 22 requirement 1), written
 * by functions/src/seo/rollupSitemap.ts and read back by the sitemapXml
 * onRequest function — computing the URL list is too expensive to do on
 * every crawler hit, so it's precomputed on a schedule and cached here.
 * Sharded (a few thousand URLs each) to stay well under the sitemap
 * protocol's 50k-URL/50MB-per-file limit. Doc id: `shard-000`, `shard-001`, ...
 */
export const sitemapCacheShardSchema = z.object({
  id: z.string().min(1),
  urls: z.array(sitemapUrlEntrySchema),
  generatedAt: epochMsSchema,
})
export type SitemapCacheShard = z.infer<typeof sitemapCacheShardSchema>
export const sitemapCacheShardConverter = makeFirestoreConverter(sitemapCacheShardSchema)

/** Single doc (id: '_index') listing every shard id, so the sitemap index file (/sitemap.xml) doesn't need a collection scan. */
export const sitemapCacheIndexSchema = z.object({
  id: z.literal('_index'),
  shardIds: z.array(z.string().min(1)),
  totalUrlCount: z.number().int().nonnegative(),
  generatedAt: epochMsSchema,
})
export type SitemapCacheIndex = z.infer<typeof sitemapCacheIndexSchema>
export const sitemapCacheIndexConverter = makeFirestoreConverter(sitemapCacheIndexSchema)
