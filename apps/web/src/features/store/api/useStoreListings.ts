import { type SearchListingDocument, searchListingDocumentSchema } from '@snapspare/shared'
import { useQuery } from '@tanstack/react-query'
import { getSearchClient, SEARCH_COLLECTION_NAME } from '@/features/search/api/searchClient'

const PER_PAGE = 48

/**
 * A seller's full public listing grid (requirement 7) — queried against the
 * `listings` Typesense collection rather than Firestore directly, since
 * buildSearchDocument.ts already excludes any non-`active` listing from the
 * index (returns null, callers delete), so a single `sellerId:=X` filter is
 * exactly "this seller's active listings" with no extra status filter
 * needed. Reuses the same public search-only scoped key buyer search pages
 * use (createSearchKey.ts doesn't require auth).
 */
export function useStoreListings(sellerId: string | undefined) {
  return useQuery({
    queryKey: ['store-listings', sellerId],
    queryFn: async (): Promise<SearchListingDocument[]> => {
      if (!sellerId) return []
      const client = await getSearchClient()
      const result = await client.collections(SEARCH_COLLECTION_NAME).documents().search({
        q: '*',
        query_by: 'title',
        filter_by: `sellerId:=${sellerId}`,
        per_page: PER_PAGE,
      })

      const documents: SearchListingDocument[] = []
      for (const hit of result.hits ?? []) {
        const parsed = searchListingDocumentSchema.safeParse(hit.document)
        if (parsed.success) documents.push(parsed.data)
      }
      return documents
    },
    enabled: Boolean(sellerId),
    staleTime: 30_000,
  })
}
