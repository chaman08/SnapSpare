import { type CatalogPart, type Listing, listingSchema, type PartCondition } from '@snapspare/shared'
import { pick, randomInt, weightedBool } from '../lib/random.js'
import type { SellerBlueprint } from './sellers.js'

const TOTAL_LISTINGS = 900

const CONDITION_WEIGHTS: Array<[PartCondition, number]> = [
  ['new', 0.8],
  ['refurbished', 0.12],
  ['used', 0.08],
]

const STATUS_WEIGHTS: Array<[Listing['status'], number]> = [
  ['active', 0.78],
  ['paused', 0.07],
  ['out_of_stock', 0.06],
  ['draft', 0.04],
  ['rejected', 0.03],
  ['archived', 0.02],
]

/** Approximate per-unit rupee price range by top-level category, at MOQ (the ladder's cheapest tier goes below this). */
const CATEGORY_PRICE_RANGE_RUPEES: Record<string, [number, number]> = {
  engine: [300, 15_000],
  brake: [200, 6_000],
  'suspension-and-steering': [300, 8_000],
  electrical: [150, 12_000],
  filters: [100, 1_200],
  'lubricants-and-fluids': [150, 3_000],
  'body-and-panels': [500, 20_000],
  lighting: [150, 5_000],
  'clutch-and-transmission': [400, 10_000],
  cooling: [300, 6_000],
  exhaust: [500, 15_000],
  'tyres-and-wheels': [1_500, 8_000],
  battery: [1_200, 9_000],
  bearings: [100, 2_500],
  cables: [80, 1_200],
  consumables: [20, 800],
  accessories: [100, 4_000],
  tools: [150, 5_000],
}

function weightedPick<T>(rng: () => number, weights: Array<[T, number]>): T {
  const roll = rng()
  let cumulative = 0
  for (const [value, weight] of weights) {
    cumulative += weight
    if (roll < cumulative) return value
  }
  return weights[weights.length - 1]![0]
}

/**
 * Builds a schema-valid quantity-slab ladder: first tier minQty == moq,
 * ranges ascending/contiguous, only the last tier open-ended, and price
 * strictly decreases tier-over-tier (guaranteed by construction, not just by
 * chance) — mirrors the invariants in listingPricingSchema's superRefine.
 */
function buildPricingLadder(rng: () => number, moq: number, basePricePaise: number, tierCount: number) {
  const tiers: { minQty: number; maxQty: number | null; unitPricePaise: number }[] = []
  let minQty = moq
  let price = basePricePaise

  for (let i = 0; i < tierCount; i++) {
    const isLast = i === tierCount - 1
    const maxQty = isLast ? null : minQty + randomInt(rng, 4, 45)
    tiers.push({ minQty, maxQty, unitPricePaise: price })

    if (!isLast) {
      const reduction = 0.05 + rng() * 0.15
      const nextPrice = Math.min(price - 1, Math.round(price * (1 - reduction)))
      price = Math.max(1, nextPrice)
      minQty = (maxQty as number) + 1
    }
  }

  return { moq, tiers }
}

function priceRangeForPart(part: CatalogPart): [number, number] {
  return CATEGORY_PRICE_RANGE_RUPEES[part.categorySlug] ?? [200, 3_000]
}

export function generateListings(
  rng: () => number,
  parts: CatalogPart[],
  sellers: SellerBlueprint[],
): Listing[] {
  const now = Date.now()
  const listings: Listing[] = []

  const partsBySellerCategory = new Map<string, CatalogPart[]>()
  for (const seller of sellers) {
    partsBySellerCategory.set(
      seller.id,
      parts.filter((part) => seller.categorySlugs.includes(part.categorySlug)),
    )
  }

  for (let i = 0; i < TOTAL_LISTINGS; i++) {
    const seller = sellers[i % sellers.length] as SellerBlueprint
    const specialtyParts = partsBySellerCategory.get(seller.id) ?? []
    const candidatePool = specialtyParts.length > 0 && weightedBool(rng, 0.7) ? specialtyParts : parts
    const part = pick(rng, candidatePool)

    const [minRupees, maxRupees] = priceRangeForPart(part)
    const basePricePaise = randomInt(rng, minRupees, maxRupees) * 100
    const moq = pick(rng, [1, 1, 1, 2, 5, 10])
    const tierCount = randomInt(rng, 1, 4)
    const pricing = buildPricingLadder(rng, moq, basePricePaise, tierCount)

    const hasWarranty = ['battery', 'electrical', 'engine', 'clutch-and-transmission'].includes(part.categorySlug)
    const createdAt = now - randomInt(rng, 0, 300) * 86_400_000

    const listing = listingSchema.parse({
      id: `listing-${i + 1}`,
      sellerId: seller.id,
      partId: part.id,
      sku: `${seller.id.split('-')[1]?.slice(0, 3).toUpperCase()}-${part.partNumber}-${i + 1}`,
      title: part.name,
      condition: weightedPick(rng, CONDITION_WEIGHTS),
      stockQty: randomInt(rng, 0, 500),
      maxOrderQty: weightedBool(rng, 0.3) ? randomInt(rng, moq * 10, moq * 50) : undefined,
      pricing,
      mrpPaise: weightedBool(rng, 0.6)
        ? Math.round(basePricePaise * (1 + 0.1 + rng() * 0.3))
        : undefined,
      taxIncluded: weightedBool(rng, 0.5),
      hsnCode: part.hsnCode,
      gstRatePercent: part.gstRatePercent,
      warrantyMonths: hasWarranty && weightedBool(rng, 0.6) ? pick(rng, [6, 12, 18, 24]) : undefined,
      status: weightedPick(rng, STATUS_WEIGHTS),
      isFeatured: weightedBool(rng, 0.05),
      createdAt,
      updatedAt: createdAt,
    })

    listings.push(listing)
  }

  return listings
}
