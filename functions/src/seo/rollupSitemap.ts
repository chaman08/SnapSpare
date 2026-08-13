import { CATEGORY_TREE, slugify } from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { getSiteOrigin } from './siteOrigin.js'

interface SitemapUrl {
  loc: string
  lastmod?: number
}

const SHARD_SIZE = 2000
// Firestore-doc-read and function-memory budget cap for the highest-volume
// entity in the sitemap (catalog parts) — ordered by ratingBayesian so the
// most-established parts are covered first if the catalogue ever exceeds
// this. Raise once real traffic/inventory numbers justify the extra cost;
// see the Phase 22 README note.
const MAX_CATALOG_PARTS = 8000

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size))
  return chunks
}

/**
 * Precomputes the full sitemap URL list on a schedule (Phase 22 requirement
 * 1) so the sitemapXml onRequest function never has to assemble it live on
 * a crawler's request — a Googlebot hit on /sitemap.xml is a cache read of a
 * couple of Firestore docs, not a fan-out query across half a dozen
 * collections. Sharded into `sitemapCache/{shardId}` docs (a few thousand
 * URLs each) to stay well under the sitemap protocol's 50k-URL/50MB limit;
 * `sitemapCache/_index` lists every shard id for the /sitemap.xml index file.
 */
export const rollupSitemap = onSchedule(
  { region: 'asia-south1', schedule: 'every day 02:00', timeZone: 'Etc/UTC', timeoutSeconds: 540, memory: '1GiB' },
  async () => {
    const db = getFirestore()
    const SITE_ORIGIN = await getSiteOrigin(db)
    const urls: SitemapUrl[] = []

    urls.push({ loc: `${SITE_ORIGIN}/` }, { loc: `${SITE_ORIGIN}/categories` })

    for (const category of CATEGORY_TREE) {
      urls.push({ loc: `${SITE_ORIGIN}/parts/${category.slug}` })
      for (const sub of category.subcategories) {
        urls.push({ loc: `${SITE_ORIGIN}/parts/${category.slug}/${sub.slug}` })
      }
    }

    const [brandsSnap, storeSlugsSnap, makesSnap, modelsSnap, landingSnap, partsSnap] = await Promise.all([
      db.collection('brands').where('status', '==', 'active').get(),
      db.collection('storeSlugReservations').get(),
      db.collection('vehicleMakes').where('status', '==', 'active').get(),
      db.collection('vehicleModels').where('status', '==', 'active').get(),
      db.collection('seoLandingPages').get(),
      db.collection('catalogParts').where('status', '==', 'active').orderBy('ratingBayesian', 'desc').limit(MAX_CATALOG_PARTS).get(),
    ])

    for (const doc of brandsSnap.docs) {
      const slug = (doc.data() as { slug?: string }).slug
      if (slug) urls.push({ loc: `${SITE_ORIGIN}/brand/${slug}` })
    }

    for (const doc of storeSlugsSnap.docs) {
      urls.push({ loc: `${SITE_ORIGIN}/store/${doc.id}` })
    }

    const makeById = new Map(makesSnap.docs.map((doc) => [doc.id, doc.data() as { slug: string }]))
    for (const doc of modelsSnap.docs) {
      const model = doc.data() as { makeId: string; slug: string; yearFrom: number }
      const make = makeById.get(model.makeId)
      if (!make) continue
      // One representative URL per model (yearFrom) rather than one per
      // model-year — every year in a model's range would multiply this
      // section several-fold for no real SEO benefit (the page content
      // barely differs year to year); year-specific pages are still
      // reachable and indexable, they just aren't all individually listed.
      urls.push({ loc: `${SITE_ORIGIN}/vehicle/${make.slug}/${model.slug}/${model.yearFrom}` })
    }

    for (const doc of landingSnap.docs) {
      const page = doc.data() as { categorySlug: string; subcategorySlug?: string; vehicleSlug: string; updatedAt: number }
      urls.push({
        loc: `${SITE_ORIGIN}/parts/${page.categorySlug}/${page.subcategorySlug ?? 'all'}/${page.vehicleSlug}`,
        lastmod: page.updatedAt,
      })
    }

    for (const doc of partsSnap.docs) {
      const part = doc.data() as { name: string; slug?: string; updatedAt: number }
      const slug = part.slug ?? slugify(part.name)
      urls.push({ loc: `${SITE_ORIGIN}/parts/p/${slug}-${doc.id}`, lastmod: part.updatedAt })
    }

    const shards = chunk(urls, SHARD_SIZE)
    const now = Date.now()
    const shardIds = shards.map((_, index) => `shard-${String(index).padStart(3, '0')}`)

    await Promise.all(
      shards.map((shardUrls, index) =>
        db
          .collection('sitemapCache')
          .doc(shardIds[index]!)
          .set({ urls: shardUrls, generatedAt: now }),
      ),
    )

    // Delete any shard left over from a previous run that generated more
    // shards than this run needed (URL count shrank) — otherwise a stale
    // shard stays reachable and listed nowhere, orphaned but still live.
    const existingShardsSnap = await db.collection('sitemapCache').get()
    const staleShardIds = existingShardsSnap.docs
      .map((doc) => doc.id)
      .filter((id) => id !== '_index' && !shardIds.includes(id))
    await Promise.all(staleShardIds.map((id) => db.collection('sitemapCache').doc(id).delete()))

    await db.collection('sitemapCache').doc('_index').set({ shardIds, totalUrlCount: urls.length, generatedAt: now })

    logger.info('rollupSitemap: regenerated', { totalUrlCount: urls.length, shardCount: shards.length })
  },
)
