import type { CatalogPart, Listing } from '@snapspare/shared'
import { fromPaise } from '@snapspare/shared'

export { serializeJsonLd } from '@snapspare/shared'

export interface ProductJsonLdInput {
  part: CatalogPart
  canonicalUrl: string
  offers: Listing[]
  aggregateRating?: { ratingValue: number; reviewCount: number }
}

/**
 * schema.org Product structured data for SEO rich results. Offers are
 * summarised as a single AggregateOffer (low/high price across every active
 * seller) rather than one Offer per listing — Google's guidance for a
 * multi-seller product page, and it avoids needing a per-seller URL we
 * don't have. aggregateRating is only emitted when there's at least one
 * real review: fabricating a rating with zero reviews is exactly the kind
 * of thing Google's structured-data guidelines call out as spammy.
 */
export function buildProductJsonLd({
  part,
  canonicalUrl,
  offers,
  aggregateRating,
}: ProductJsonLdInput): Record<string, unknown> {
  const unitPrices = offers
    .map((offer) => offer.pricing.tiers[0]?.unitPricePaise)
    .filter((price): price is number => typeof price === 'number' && price > 0)

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: part.name,
    description: part.description,
    brand: part.brand ? { '@type': 'Brand', name: part.brand } : undefined,
    sku: part.partNumber,
    mpn: part.oemNumbers[0],
    image: part.images.length > 0 ? part.images : undefined,
    url: canonicalUrl,
  }

  if (unitPrices.length > 0) {
    jsonLd.offers = {
      '@type': 'AggregateOffer',
      priceCurrency: 'INR',
      lowPrice: fromPaise(Math.min(...unitPrices)).toFixed(2),
      highPrice: fromPaise(Math.max(...unitPrices)).toFixed(2),
      offerCount: offers.length,
      availability: offers.some((offer) => offer.stockQty > 0)
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
    }
  }

  if (aggregateRating && aggregateRating.reviewCount > 0) {
    jsonLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: aggregateRating.ratingValue.toFixed(1),
      reviewCount: aggregateRating.reviewCount,
    }
  }

  return jsonLd
}
