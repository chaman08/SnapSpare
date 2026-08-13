/** The 18 brands named in the seed spec, distributed to the category they'd realistically appear under. */
export const CATEGORY_BRANDS: Record<string, readonly string[]> = {
  engine: ['Bosch', 'NGK', 'Endurance', 'Motherson'],
  brake: ['TVS Girling', 'Endurance', 'Sundaram', 'Bosch'],
  'suspension-and-steering': ['Gabriel', 'Endurance', 'Sundaram'],
  electrical: ['Bosch', 'Minda', 'Lumax', 'Motherson'],
  filters: ['Bosch', 'Endurance', 'Sundaram'],
  'lubricants-and-fluids': ['Castrol', 'Shell', 'Mobil'],
  'body-and-panels': ['Motherson', 'Lumax'],
  lighting: ['Lumax', 'Minda', 'Bosch'],
  'clutch-and-transmission': ['Valeo', 'Endurance', 'Fenner', 'Sundaram'],
  cooling: ['Valeo', 'Endurance', 'Motherson'],
  exhaust: ['Endurance', 'Sundaram'],
  'tyres-and-wheels': ['MRF', 'TVS Girling'],
  battery: ['Exide', 'Amaron'],
  bearings: ['Endurance', 'Sundaram'],
  cables: ['Fenner', 'Motherson'],
  consumables: ['Sundaram', 'Endurance', 'Motherson'],
  accessories: ['Motherson', 'Minda', 'Lumax'],
  tools: ['Bosch', 'Endurance'],
}

export const FALLBACK_BRANDS = ['Bosch', 'Endurance', 'Motherson', 'Lumax', 'Minda', 'Sundaram'] as const

export function brandsForCategory(categorySlug: string): readonly string[] {
  return CATEGORY_BRANDS[categorySlug] ?? FALLBACK_BRANDS
}

/** GST rate per top-level category — most auto parts sit at 28%, a handful of categories at 18%. Tweak here if rates change. */
export const CATEGORY_GST_PERCENT: Record<string, 18 | 28> = {
  engine: 28,
  brake: 28,
  'suspension-and-steering': 28,
  electrical: 28,
  filters: 18,
  'lubricants-and-fluids': 18,
  'body-and-panels': 28,
  lighting: 28,
  'clutch-and-transmission': 28,
  cooling: 28,
  exhaust: 28,
  'tyres-and-wheels': 28,
  battery: 28,
  bearings: 28,
  cables: 28,
  consumables: 18,
  accessories: 18,
  tools: 18,
}

/** Plausible 4-digit HSN heading per top-level category (motor-vehicle-parts chapter 8708 as the general fallback). */
export const CATEGORY_HSN: Record<string, string> = {
  engine: '8409',
  brake: '8708',
  'suspension-and-steering': '8708',
  electrical: '8511',
  filters: '8421',
  'lubricants-and-fluids': '2710',
  'body-and-panels': '8708',
  lighting: '8512',
  'clutch-and-transmission': '8708',
  cooling: '8708',
  exhaust: '8708',
  'tyres-and-wheels': '4011',
  battery: '8507',
  bearings: '8482',
  cables: '8544',
  consumables: '3926',
  accessories: '8708',
  tools: '8206',
}
const DEFAULT_HSN = '8708'
export function hsnForCategory(categorySlug: string): string {
  return CATEGORY_HSN[categorySlug] ?? DEFAULT_HSN
}

export function gstForCategory(categorySlug: string): 18 | 28 {
  return CATEGORY_GST_PERCENT[categorySlug] ?? 28
}

/** Categories/subcategories that only fit a subset of vehicle classes; everything else fits all classes. */
export const TWO_WHEELER_ONLY_SUBCATEGORY_SLUGS = new Set(['two-wheeler-batteries'])
export const FOUR_PLUS_WHEELER_ONLY_SUBCATEGORY_SLUGS = new Set([
  'car-batteries',
  'alloy-wheels',
  'steel-wheels',
])
