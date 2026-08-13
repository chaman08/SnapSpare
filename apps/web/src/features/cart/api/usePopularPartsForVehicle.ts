import { type SearchListingDocument, searchListingDocumentSchema } from '@snapspare/shared'
import { useQuery } from '@tanstack/react-query'
import { getSearchClient, SEARCH_COLLECTION_NAME } from '@/features/search/api/searchClient'

const RAIL_SIZE = 6

/** Backs the empty cart's "popular parts for your vehicle" rail (design spec item 9) — the most-viewed active listings verified to fit the buyer's active vehicle. Renders nothing (see CartEmptyState) when there's no active vehicle or no fitment-matched listings yet, rather than showing an unrelated "trending" fallback. */
export function usePopularPartsForVehicle(modelId: string | undefined) {
  return useQuery({
    queryKey: ['popular-parts-for-vehicle', modelId],
    queryFn: async (): Promise<SearchListingDocument[]> => {
      if (!modelId) return []
      const client = await getSearchClient()
      const result = await client
        .collections(SEARCH_COLLECTION_NAME)
        .documents()
        .search({
          q: '*',
          query_by: 'title',
          filter_by: `modelIds:=[\`${modelId}\`] && inStock:=true`,
          sort_by: 'popularityScore:desc',
          per_page: RAIL_SIZE,
        })

      const documents: SearchListingDocument[] = []
      for (const hit of result.hits ?? []) {
        const parsed = searchListingDocumentSchema.safeParse(hit.document)
        if (parsed.success) documents.push(parsed.data)
      }
      return documents
    },
    enabled: Boolean(modelId),
    staleTime: 60_000,
  })
}
