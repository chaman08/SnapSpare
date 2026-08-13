import type { PartCondition, PartType } from '@snapspare/shared'

export type SearchSortOption = 'relevance' | 'price_asc' | 'delivery' | 'rating'

export interface SearchFilters {
  category?: string
  subCategory?: string
  brand: string[]
  type: PartType[]
  condition: PartCondition[]
  sellerRatingMin?: number
  warrantyMonthsMin?: number
  inStockOnly: boolean
  /** Applied only when both this is true and vehicleModelId is set — see the fits-my-vehicle toggle's default-ON behaviour in FacetSidebar/FilterSheet. */
  fitsMyVehicle: boolean
  vehicleModelId?: string
  /** Set when a buyer picks a make from search suggestions — independent of the fits-my-vehicle toggle, which only ever applies vehicleModelId. */
  vehicleMakeId?: string
  maxDeliveryEtaDays?: number
  priceMinPaise?: number
  priceMaxPaise?: number
}

export const EMPTY_SEARCH_FILTERS: SearchFilters = {
  brand: [],
  type: [],
  condition: [],
  inStockOnly: false,
  fitsMyVehicle: true,
}

export function hasActiveFilters(filters: SearchFilters): boolean {
  return (
    filters.brand.length > 0 ||
    filters.type.length > 0 ||
    filters.condition.length > 0 ||
    Boolean(filters.sellerRatingMin) ||
    Boolean(filters.warrantyMonthsMin) ||
    filters.inStockOnly ||
    Boolean(filters.maxDeliveryEtaDays) ||
    filters.priceMinPaise != null ||
    filters.priceMaxPaise != null
  )
}
