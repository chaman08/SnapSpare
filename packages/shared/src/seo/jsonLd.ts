/**
 * schema.org JSON-LD builders shared by every SEO-relevant page (Phase 22
 * requirement 1). Pure object builders — no DOM/browser API — so they're
 * usable from web pages and, if a future prerender/report tool ever needs
 * one, from Node too. Product JSON-LD stays in
 * apps/web/src/features/catalog/lib/productJsonLd.ts (predates this module,
 * takes CatalogPart/Listing types already scoped to the product page) —
 * `serializeJsonLd` here is the single implementation it re-exports.
 */

/** Escapes '<' so the serialized JSON can't be broken out of its <script> tag (e.g. a description containing "</script>"). */
export function serializeJsonLd(jsonLd: Record<string, unknown>): string {
  return JSON.stringify(jsonLd).replace(/</g, '\\u003c')
}

export interface OrganizationJsonLdInput {
  name: string
  url: string
  logoUrl?: string
  sameAs?: string[]
}

/** Site-wide Organization JSON-LD — one instance, rendered once (HomePage/AppShell), not per-page. */
export function buildOrganizationJsonLd(input: OrganizationJsonLdInput): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: input.name,
    url: input.url,
    logo: input.logoUrl,
    sameAs: input.sameAs && input.sameAs.length > 0 ? input.sameAs : undefined,
  }
}

export interface BreadcrumbItem {
  name: string
  url: string
}

export function buildBreadcrumbListJsonLd(items: BreadcrumbItem[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  }
}

export interface FaqJsonLdItem {
  question: string
  answer: string
}

/** Only emit on a page whose FAQ content is genuinely visible on the page — Google delists structured data that doesn't match rendered content. */
export function buildFaqPageJsonLd(items: FaqJsonLdItem[]): Record<string, unknown> | null {
  if (items.length === 0) return null
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  }
}

export interface LocalBusinessJsonLdInput {
  name: string
  url: string
  imageUrl?: string
  ratingValue?: number
  reviewCount?: number
  addressLocality?: string
  addressRegion?: string
  postalCode?: string
}

/** Rendered on /store/:sellerSlug — a seller's public store page reads as a local business listing (India GST-registered merchant), not a generic Organization. */
export function buildLocalBusinessJsonLd(input: LocalBusinessJsonLdInput): Record<string, unknown> {
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: input.name,
    url: input.url,
    image: input.imageUrl,
  }
  if (input.addressLocality || input.addressRegion || input.postalCode) {
    jsonLd.address = {
      '@type': 'PostalAddress',
      addressLocality: input.addressLocality,
      addressRegion: input.addressRegion,
      postalCode: input.postalCode,
      addressCountry: 'IN',
    }
  }
  if (input.ratingValue !== undefined && input.reviewCount !== undefined && input.reviewCount > 0) {
    jsonLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: input.ratingValue.toFixed(1),
      reviewCount: input.reviewCount,
    }
  }
  return jsonLd
}
