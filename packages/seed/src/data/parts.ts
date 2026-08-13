import { CATEGORY_TREE, type CatalogPart, catalogPartSchema, type PartType } from '@snapspare/shared'
import { pick, randomInt, weightedBool } from '../lib/random.js'
import { slugify } from '../lib/slug.js'
import { brandsForCategory, gstForCategory, hsnForCategory } from './brands.js'

const TOTAL_PARTS = 300

const DESCRIPTORS = ['Standard', 'Heavy Duty', 'Premium', 'OEM Spec', 'Economy', 'Performance', 'Long Life']

function pickPartType(rng: () => number): PartType {
  const roll = rng()
  if (roll < 0.5) return 'aftermarket'
  if (roll < 0.75) return 'genuine'
  if (roll < 0.9) return 'oem'
  return 'oes'
}

/** Plausible (not officially registered) OEM-style part number: 2-4 letter unit code + 6-digit sequence. */
function buildPartNumber(categorySlug: string, subcategorySlug: string, sequence: number): string {
  const prefix = (categorySlug.slice(0, 2) + subcategorySlug.slice(0, 2)).toUpperCase()
  return `${prefix}-${String(sequence).padStart(6, '0')}`
}

interface CategorySubcategoryPair {
  categorySlug: string
  categoryName: string
  subcategorySlug: string
  subcategoryName: string
}

function flattenCategoryTree(): CategorySubcategoryPair[] {
  const pairs: CategorySubcategoryPair[] = []
  for (const category of CATEGORY_TREE) {
    for (const subcategory of category.subcategories) {
      pairs.push({
        categorySlug: category.slug,
        categoryName: category.name,
        subcategorySlug: subcategory.slug,
        subcategoryName: subcategory.name,
      })
    }
  }
  return pairs
}

/** Distributes TOTAL_PARTS as evenly as possible across every (category, subcategory) pair. */
function partCountsPerPair(pairCount: number): number[] {
  const base = Math.floor(TOTAL_PARTS / pairCount)
  const remainder = TOTAL_PARTS - base * pairCount
  return Array.from({ length: pairCount }, (_, index) => base + (index < remainder ? 1 : 0))
}

export function generateCatalogParts(rng: () => number): CatalogPart[] {
  const pairs = flattenCategoryTree()
  const counts = partCountsPerPair(pairs.length)
  const now = Date.now()
  const parts: CatalogPart[] = []
  let sequence = 100001

  pairs.forEach((pair, pairIndex) => {
    const count = counts[pairIndex] ?? 0
    const brands = brandsForCategory(pair.categorySlug)

    for (let i = 0; i < count; i++) {
      const brand = pick(rng, brands)
      const descriptor = pick(rng, DESCRIPTORS)
      const id = `part-${slugify(pair.subcategorySlug)}-${sequence}`
      const name = `${brand} ${pair.subcategoryName} (${descriptor})`

      const parsed = catalogPartSchema.parse({
        id,
        partNumber: buildPartNumber(pair.categorySlug, pair.subcategorySlug, sequence),
        partType: pickPartType(rng),
        categorySlug: pair.categorySlug,
        subcategorySlug: pair.subcategorySlug,
        name,
        description: `${descriptor} ${pair.subcategoryName.toLowerCase()} compatible with a wide range of Indian passenger and commercial vehicles.`,
        brand,
        hsnCode: hsnForCategory(pair.categorySlug),
        gstRatePercent: gstForCategory(pair.categorySlug),
        status: weightedBool(rng, 0.97) ? 'active' : 'inactive',
        createdAt: now - randomInt(rng, 0, 200) * 86_400_000,
        updatedAt: now,
      })

      parts.push(parsed)
      sequence += 1
    }
  })

  return parts
}
