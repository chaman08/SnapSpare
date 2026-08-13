import { CATEGORY_TREE, searchListingDocumentSchema } from '@snapspare/shared'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useVehicleMakes } from '@/features/auth/api/vehicleCatalog'
import { getSearchClient, SEARCH_COLLECTION_NAME } from './searchClient'

export interface PartSuggestion {
  partId: string
  listingId: string
  title: string
  imageUrl?: string
}

export interface CategorySuggestion {
  type: 'category' | 'subcategory'
  categorySlug: string
  subCategorySlug?: string
  label: string
}

export interface VehicleSuggestion {
  makeId: string
  name: string
  logoUrl?: string
}

const MIN_QUERY_LENGTH = 2
const MAX_PER_GROUP = 5

/**
 * Instant-search suggestions grouped as Parts / Brands / Categories /
 * Vehicles. Categories and vehicle makes are matched entirely client-side
 * (CATEGORY_TREE is a static constant; vehicleMakes is already cached with
 * `staleTime: Infinity` by useVehicleMakes, typically pre-warmed by the
 * header's VehicleSelector) — only parts/brands need a Typesense round trip.
 * Vehicle suggestions are scoped to makes only, not the full model catalog,
 * to avoid an extra "fetch every model across every make" query; picking a
 * make suggestion routes into the category page's vehicle picker instead of
 * resolving a specific model.
 */
export function useSearchSuggestions(query: string) {
  const trimmed = query.trim()
  const makesQuery = useVehicleMakes()

  const localMatches = useMemo(() => {
    if (trimmed.length < MIN_QUERY_LENGTH) return { categories: [] as CategorySuggestion[], vehicles: [] as VehicleSuggestion[] }
    const q = trimmed.toLowerCase()

    const categories: CategorySuggestion[] = []
    for (const category of CATEGORY_TREE) {
      if (categories.length >= MAX_PER_GROUP) break
      if (category.name.toLowerCase().includes(q)) {
        categories.push({ type: 'category', categorySlug: category.slug, label: category.name })
      }
      for (const sub of category.subcategories) {
        if (categories.length >= MAX_PER_GROUP) break
        if (sub.name.toLowerCase().includes(q)) {
          categories.push({
            type: 'subcategory',
            categorySlug: category.slug,
            subCategorySlug: sub.slug,
            label: `${sub.name} · ${category.name}`,
          })
        }
      }
    }

    const vehicles = (makesQuery.data ?? [])
      .filter((make) => make.name.toLowerCase().includes(q))
      .slice(0, MAX_PER_GROUP)
      .map((make) => ({ makeId: make.id, name: make.name, logoUrl: make.logoUrl }))

    return { categories, vehicles }
  }, [trimmed, makesQuery.data])

  const remoteQuery = useQuery({
    queryKey: ['search-suggestions', trimmed],
    queryFn: async () => {
      const client = await getSearchClient()
      const result = await client
        .collections(SEARCH_COLLECTION_NAME)
        .documents()
        .search({
          q: trimmed,
          query_by: 'title,brand,partNumber,oemNumbers,crossRefNumbers',
          query_by_weights: '4,3,5,5,4',
          per_page: 8,
          facet_by: 'brand',
          max_facet_values: MAX_PER_GROUP,
        })

      const parts: PartSuggestion[] = []
      for (const hit of (result.hits ?? []).slice(0, MAX_PER_GROUP)) {
        const parsed = searchListingDocumentSchema.safeParse(hit.document)
        if (parsed.success) {
          parts.push({
            partId: parsed.data.partId,
            listingId: parsed.data.listingId,
            title: parsed.data.title,
            imageUrl: parsed.data.imageUrl,
          })
        }
      }

      const brandFacet = result.facet_counts?.find((f) => f.field_name === 'brand')
      const brands = (brandFacet?.counts ?? [])
        .map((c) => c.value)
        .filter((v): v is string => Boolean(v))
        .slice(0, MAX_PER_GROUP)

      return { parts, brands }
    },
    enabled: trimmed.length >= MIN_QUERY_LENGTH,
    staleTime: 30_000,
  })

  return {
    isLoading: remoteQuery.isFetching,
    parts: remoteQuery.data?.parts ?? [],
    brands: remoteQuery.data?.brands ?? [],
    categories: localMatches.categories,
    vehicles: localMatches.vehicles,
  }
}
