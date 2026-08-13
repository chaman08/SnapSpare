/**
 * Shared slug generator — same rules as the inline helpers in
 * constants/categories.ts, pulled out here so catalogPart/brand/landing-page
 * slugs are generated identically wherever a slug is derived from a name
 * (admin catalogue save, bulk import, SEO landing-page generation).
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

/**
 * Firestore auto-generated document ids are 20 characters from
 * `[A-Za-z0-9]` (no hyphens) — see `db.collection(x).doc().id`. A product
 * URL segment is `${slug}-${partId}`; this pulls the trailing id back out so
 * the slug itself (display-only, never used for lookup) can change freely
 * without breaking the URL. Falls back to treating the whole segment as the
 * id if it doesn't look like `...-<20 alnum chars>` (e.g. a hand-typed or
 * truncated URL), which keeps old bare-id links working.
 */
export function parsePartSlugId(segment: string | undefined): string | undefined {
  if (!segment) return undefined
  const match = /-([a-zA-Z0-9]{20})$/.exec(segment)
  return match?.[1] ?? segment
}

export function buildPartSlugId(slug: string | undefined, partId: string): string {
  return slug ? `${slug}-${partId}` : partId
}
