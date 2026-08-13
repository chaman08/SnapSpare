import { getFirestore } from 'firebase-admin/firestore'
import { onRequest } from 'firebase-functions/v2/https'

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Serves /sitemap.xml (the index) and /sitemap-:shardId.xml (each shard) —
 * wired via firebase.json hosting rewrites, which must list these two
 * patterns *before* the catch-all SPA rewrite (Hosting matches rewrites in
 * order, first match wins). Pure cache reads against `sitemapCache/*`,
 * populated by rollupSitemap.ts on a schedule — this function never
 * recomputes the URL list itself, so a crawler hit is cheap regardless of
 * catalogue size.
 */
export const sitemapXml = onRequest({ region: 'asia-south1' }, async (req, res) => {
  const db = getFirestore()
  const shardMatch = /^\/sitemap-(shard-\d+)\.xml$/.exec(req.path)

  if (shardMatch) {
    const shardId = shardMatch[1]!
    const snapshot = await db.collection('sitemapCache').doc(shardId).get()
    if (!snapshot.exists) {
      res.status(404).send('Sitemap shard not found')
      return
    }
    const shard = snapshot.data() as { urls: { loc: string; lastmod?: number }[] }
    const body = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...shard.urls.map(
        (url) =>
          `  <url><loc>${escapeXml(url.loc)}</loc>${url.lastmod ? `<lastmod>${new Date(url.lastmod).toISOString().slice(0, 10)}</lastmod>` : ''}</url>`,
      ),
      '</urlset>',
    ].join('\n')
    res.set('Content-Type', 'application/xml; charset=UTF-8').set('Cache-Control', 'public, max-age=3600').send(body)
    return
  }

  const indexSnapshot = await db.collection('sitemapCache').doc('_index').get()
  if (!indexSnapshot.exists) {
    res.status(404).send('Sitemap not generated yet')
    return
  }
  const index = indexSnapshot.data() as { shardIds: string[] }
  const origin = `${req.protocol}://${req.get('host') ?? ''}`
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...index.shardIds.map((shardId) => `  <sitemap><loc>${origin}/sitemap-${shardId}.xml</loc></sitemap>`),
    '</sitemapindex>',
  ].join('\n')
  res.set('Content-Type', 'application/xml; charset=UTF-8').set('Cache-Control', 'public, max-age=3600').send(body)
})
