import { type SearchCatalogPartDocument, searchCatalogPartDocumentSchema } from '@snapspare/shared'
import { useQuery } from '@tanstack/react-query'
import { CATALOG_PART_SEARCH_COLLECTION_NAME, getCatalogPartSearchClient } from './searchCatalogParts'

const MIN_QUERY_LENGTH = 2
const PER_PAGE = 10

/** Typeahead over the `catalog_parts` Typesense collection — part number weighted highest, then name/brand/oemNumbers/crossRefNumbers. */
export function useCatalogPartSearch(query: string) {
  const trimmed = query.trim()

  return useQuery({
    queryKey: ['catalog-part-search', trimmed],
    queryFn: async (): Promise<SearchCatalogPartDocument[]> => {
      const client = await getCatalogPartSearchClient()
      const result = await client
        .collections(CATALOG_PART_SEARCH_COLLECTION_NAME)
        .documents()
        .search({
          q: trimmed,
          query_by: 'partNumber,name,brand,oemNumbers,crossRefNumbers',
          query_by_weights: '5,4,3,5,4',
          per_page: PER_PAGE,
        })

      const parts: SearchCatalogPartDocument[] = []
      for (const hit of result.hits ?? []) {
        const parsed = searchCatalogPartDocumentSchema.safeParse(hit.document)
        if (parsed.success) parts.push(parsed.data)
      }
      return parts
    },
    enabled: trimmed.length >= MIN_QUERY_LENGTH,
    staleTime: 30_000,
  })
}
