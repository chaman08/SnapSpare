import type { SearchFilters, SearchSortOption } from '../types'

/** Wraps a facet value in backticks if it needs it — Typesense's filter_by syntax requires backticks around values containing spaces/commas. */
function quoteIfNeeded(value: string): string {
  return /[\s,`]/.test(value) ? `\`${value}\`` : value
}

function inClause(field: string, values: string[]): string | undefined {
  if (values.length === 0) return undefined
  return `${field}:=[${values.map(quoteIfNeeded).join(',')}]`
}

/** Builds a Typesense `filter_by` string from the results page's active facet selections. Empty string means "no filter". */
export function buildFilterBy(filters: SearchFilters): string {
  const clauses: string[] = []

  if (filters.category) clauses.push(`category:=${quoteIfNeeded(filters.category)}`)
  if (filters.subCategory) clauses.push(`subCategory:=${quoteIfNeeded(filters.subCategory)}`)

  const brandClause = inClause('brand', filters.brand)
  if (brandClause) clauses.push(brandClause)

  const typeClause = inClause('type', filters.type)
  if (typeClause) clauses.push(typeClause)

  const conditionClause = inClause('condition', filters.condition)
  if (conditionClause) clauses.push(conditionClause)

  if (filters.sellerRatingMin) clauses.push(`maxRating:>=${filters.sellerRatingMin}`)
  if (filters.warrantyMonthsMin) clauses.push(`warrantyMonths:>=${filters.warrantyMonthsMin}`)
  if (filters.inStockOnly) clauses.push('inStock:=true')
  if (filters.maxDeliveryEtaDays) clauses.push(`deliveryEtaDays:<=${filters.maxDeliveryEtaDays}`)
  if (filters.priceMinPaise != null) clauses.push(`minPricePaise:>=${filters.priceMinPaise}`)
  if (filters.priceMaxPaise != null) clauses.push(`minPricePaise:<=${filters.priceMaxPaise}`)

  // fits-my-vehicle and a category page's vehicle-scoped variant both filter
  // on the same modelIds facet — whichever supplied a vehicleModelId wins,
  // gated on the toggle actually being on.
  if (filters.vehicleModelId && filters.fitsMyVehicle) {
    clauses.push(`modelIds:=${quoteIfNeeded(filters.vehicleModelId)}`)
  }

  if (filters.vehicleMakeId) {
    clauses.push(`makeIds:=${quoteIfNeeded(filters.vehicleMakeId)}`)
  }

  return clauses.join(' && ')
}

export function buildSortBy(sort: SearchSortOption): string | undefined {
  switch (sort) {
    case 'price_asc':
      return 'minPricePaise:asc'
    case 'delivery':
      return 'deliveryEtaDays:asc'
    case 'rating':
      return 'maxRating:desc'
    case 'relevance':
    default:
      return undefined
  }
}
