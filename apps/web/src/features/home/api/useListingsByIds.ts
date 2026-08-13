import type { SearchListingDocument } from '@snapspare/shared'
import { searchListingDocumentSchema } from '@snapspare/shared'
import { useQuery } from '@tanstack/react-query'
import { getSearchClient, SEARCH_COLLECTION_NAME } from '@/features/search/api/searchClient'

/** Fetches specific listings by id from Typesense (not Firestore) so home rails render the same denormalised card shape ProductCard already expects — used by deal-of-day, bulk-buy spotlight, and recently-viewed. Preserves `listingIds`' order (Typesense's `filter_by: id:[...]` does not). */
export function useListingsByIds(listingIds: string[]) {
  return useQuery({
    queryKey: ['home-listings-by-ids', listingIds],
    queryFn: async (): Promise<SearchListingDocument[]> => {
      if (listingIds.length === 0) return []
      const client = await getSearchClient()
      const result = await client
        .collections(SEARCH_COLLECTION_NAME)
        .documents()
        .search({
          q: '*',
          query_by: 'title',
          filter_by: `id:[${listingIds.join(',')}]`,
          per_page: listingIds.length,
        })

      const byId = new Map<string, SearchListingDocument>()
      for (const hit of result.hits ?? []) {
        const parsed = searchListingDocumentSchema.safeParse(hit.document)
        if (parsed.success) byId.set(parsed.data.id, parsed.data)
      }
      return listingIds.map((id) => byId.get(id)).filter((doc): doc is SearchListingDocument => Boolean(doc))
    },
    enabled: listingIds.length > 0,
    staleTime: 30_000,
  })
}
