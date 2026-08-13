import { useEffect } from 'react'

const MANAGED_ATTR = 'data-seo-managed'
const CANONICAL_LINK_ID = 'seo-canonical-link'
const HREFLANG_EN_ID = 'seo-hreflang-en'
const HREFLANG_HI_ID = 'seo-hreflang-hi'
const HREFLANG_DEFAULT_ID = 'seo-hreflang-default'
const JSON_LD_PREFIX = 'seo-json-ld-'

export interface SeoTagsInput {
  title: string
  description?: string
  /** Path only (e.g. "/parts/brake/brake-pads"), not a full URL — canonical/OG/hreflang are all built from `${window.location.origin}${path}`. */
  path: string
  ogImage?: string
  ogType?: 'website' | 'product' | 'article'
  /** Set true for thin/auto-generated pages that haven't cleared the quality bar yet (e.g. a long-tail vehicle×category combo with too few matching parts) — see CategoryPage's SEO wiring. */
  noindex?: boolean
  /** Any number of JSON-LD objects (Product, BreadcrumbList, FAQPage, ...) — `null`/`undefined` entries are skipped so callers can pass a conditional builder result directly. */
  jsonLd?: (Record<string, unknown> | null | undefined)[]
}

function upsertMeta(attr: 'name' | 'property', key: string, content: string | undefined, ids: string[]) {
  const id = `seo-meta-${attr}-${key}`
  ids.push(id)
  if (content === undefined) {
    document.getElementById(id)?.remove()
    return
  }
  let tag = document.getElementById(id) as HTMLMetaElement | null
  if (!tag) {
    tag = document.createElement('meta')
    tag.id = id
    tag.setAttribute(attr, key)
    tag.setAttribute(MANAGED_ATTR, 'true')
    document.head.appendChild(tag)
  }
  tag.content = content
}

function upsertLink(id: string, rel: string, href: string, hreflang?: string) {
  let link = document.getElementById(id) as HTMLLinkElement | null
  if (!link) {
    link = document.createElement('link')
    link.id = id
    link.rel = rel
    link.setAttribute(MANAGED_ATTR, 'true')
    document.head.appendChild(link)
  }
  link.href = href
  if (hreflang) link.hreflang = hreflang
}

/**
 * Imperative <head> tag manager — canonical, hreflang, OG/Twitter, robots,
 * and any number of JSON-LD blocks, all cleaned up on unmount. Generalizes
 * ProductDetailPage's original ad-hoc `useProductHeadTags` (Phase 8) to
 * every SEO-relevant page (Phase 22) rather than introducing
 * react-helmet-async — this codebase deliberately has no such dependency,
 * see that original hook's header comment for why.
 *
 * hreflang note: this app doesn't have per-locale URLs (i18next switches
 * language client-side on the same URL — see lib/i18n.ts), so `en`/`hi`
 * hreflang alternates both point at the same canonical URL alongside
 * `x-default`. That's a valid (if not maximal-value) hreflang signal telling
 * crawlers the page serves both languages; true per-locale URLs would need a
 * routing change out of scope for this phase — see the Phase 22 README note.
 */
export function useSeoTags(input: SeoTagsInput) {
  const { title, description, path, ogImage, ogType = 'website', noindex, jsonLd } = input
  const jsonLdKey = jsonLd ? JSON.stringify(jsonLd) : ''

  useEffect(() => {
    document.title = title
  }, [title])

  useEffect(() => {
    const url = `${window.location.origin}${path}`
    upsertLink(CANONICAL_LINK_ID, 'canonical', url)
    upsertLink(HREFLANG_EN_ID, 'alternate', url, 'en')
    upsertLink(HREFLANG_HI_ID, 'alternate', url, 'hi')
    upsertLink(HREFLANG_DEFAULT_ID, 'alternate', url, 'x-default')

    const metaIds: string[] = []
    upsertMeta('name', 'description', description, metaIds)
    upsertMeta('name', 'robots', noindex ? 'noindex,follow' : undefined, metaIds)
    upsertMeta('property', 'og:title', title, metaIds)
    upsertMeta('property', 'og:description', description, metaIds)
    upsertMeta('property', 'og:type', ogType, metaIds)
    upsertMeta('property', 'og:url', url, metaIds)
    upsertMeta('property', 'og:image', ogImage, metaIds)
    upsertMeta('property', 'og:site_name', 'SnapSpare', metaIds)
    upsertMeta('name', 'twitter:card', ogImage ? 'summary_large_image' : 'summary', metaIds)
    upsertMeta('name', 'twitter:title', title, metaIds)
    upsertMeta('name', 'twitter:description', description, metaIds)
    upsertMeta('name', 'twitter:image', ogImage, metaIds)

    return () => {
      document.getElementById(CANONICAL_LINK_ID)?.remove()
      document.getElementById(HREFLANG_EN_ID)?.remove()
      document.getElementById(HREFLANG_HI_ID)?.remove()
      document.getElementById(HREFLANG_DEFAULT_ID)?.remove()
      metaIds.forEach((id) => document.getElementById(id)?.remove())
    }
  }, [path, title, description, ogImage, ogType, noindex])

  useEffect(() => {
    const entries = (jsonLd ?? []).filter((entry): entry is Record<string, unknown> => Boolean(entry))
    const ids = entries.map((_, index) => `${JSON_LD_PREFIX}${index}`)

    entries.forEach((entry, index) => {
      const id = ids[index]
      if (!id) return
      let script = document.getElementById(id) as HTMLScriptElement | null
      if (!script) {
        script = document.createElement('script')
        script.id = id
        script.type = 'application/ld+json'
        script.setAttribute(MANAGED_ATTR, 'true')
        document.head.appendChild(script)
      }
      script.textContent = JSON.stringify(entry).replace(/</g, '\\u003c')
    })

    // Remove any stale indexed script left over from a previous render with more entries.
    let staleIndex = entries.length
    while (document.getElementById(`${JSON_LD_PREFIX}${staleIndex}`)) {
      document.getElementById(`${JSON_LD_PREFIX}${staleIndex}`)?.remove()
      staleIndex += 1
    }

    return () => {
      ids.forEach((id) => document.getElementById(id)?.remove())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- jsonLdKey is a deliberate deep-compare stand-in for the jsonLd array/object graph.
  }, [jsonLdKey])
}
