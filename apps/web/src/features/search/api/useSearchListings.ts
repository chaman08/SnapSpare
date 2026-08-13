import { type SearchListingDocument, searchListingDocumentSchema } from '@snapspare/shared'
import { useInfiniteQuery } from '@tanstack/react-query'
import { buildFilterBy, buildSortBy } from '../lib/buildFilterBy'
import { getSearchClient, SEARCH_COLLECTION_NAME } from './searchClient'
import type { SearchFilters, SearchSortOption } from '../types'

const PER_PAGE = 24

export interface SearchListingsPage {
  documents: SearchListingDocument[]
  found: number
  page: number
  hasMore: boolean
  facetCounts: Record<string, Record<string, number>>
}

interface UseSearchListingsParams {
  query: string
  filters: SearchFilters
  sort: SearchSortOption
}

interface RawFacetCount {
  field_name?: string
  counts?: { value?: string; count?: number }[]
}

/** Turns Typesense's array-of-facet-count-objects response into `{ fieldName: { value: count } }`, which is what FacetSidebar/FilterSheet want to render checkboxes with counts. */
function toFacetCounts(facetCounts: RawFacetCount[] | undefined): Record<string, Record<string, number>> {
  const result: Record<string, Record<string, number>> = {}
  for (const facet of facetCounts ?? []) {
    if (!facet.field_name) continue
    result[facet.field_name] = Object.fromEntries(
      (facet.counts ?? []).map((c) => [c.value ?? '', c.count ?? 0]),
    )
  }
  return result
}

/**
 * Infinite-scroll product search against Typesense. `q: '*'` (Typesense's
 * match-all token) is used when the query box is empty, so a category browse
 * page (which reuses this same hook with no free-text query, only filters)
 * gets identical faceting/sorting/pagination behaviour to a text search.
 */
export function useSearchListings({ query, filters, sort }: UseSearchListingsParams) {
  return useInfiniteQuery({
    queryKey: ['search-listings', query, filters, sort],
    queryFn: async ({ pageParam }): Promise<SearchListingsPage> => {
      const client = await getSearchClient()
      const filterBy = buildFilterBy(filters)

      const result = await client
        .collections(SEARCH_COLLECTION_NAME)
        .documents()
        .search({
          q: query.trim() || '*',
          query_by: 'title,brand,partNumber,oemNumbers,crossRefNumbers',
          query_by_weights: '4,3,5,5,4',
          filter_by: filterBy || undefined,
          facet_by: 'brand,category,subCategory,type,condition,warrantyMonths,inStock',
          max_facet_values: 50,
          sort_by: buildSortBy(sort),
          page: pageParam,
          per_page: PER_PAGE,
        })

      const documents: SearchListingDocument[] = []
      for (const hit of result.hits ?? []) {
        const parsed = searchListingDocumentSchema.safeParse(hit.document)
        if (parsed.success) documents.push(parsed.data)
        else console.warn('useSearchListings: skipping malformed search document', parsed.error.issues)
      }

      const found = result.found ?? 0
      return {
        documents,
        found,
        page: pageParam,
        hasMore: pageParam * PER_PAGE < found,
        facetCounts: toFacetCounts(result.facet_counts as RawFacetCount[] | undefined),
      }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.page + 1 : undefined),
    staleTime: 15_000,
  })
}
