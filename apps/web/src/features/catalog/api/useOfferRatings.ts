import type { SearchListingDocument } from '@snapspare/shared'
import { searchListingDocumentSchema } from '@snapspare/shared'
import { useQuery } from '@tanstack/react-query'
import { getSearchClient, SEARCH_COLLECTION_NAME } from '@/features/search/api/searchClient'

/**
 * Seller rating (and other denormalised-at-index-time fields) per listing,
 * keyed by listingId. Firestore's `sellers/{sellerId}` doc is locked to the
 * owning seller/admin (it also carries GSTIN/bank details), so a buyer-facing
 * page can only learn a seller's rating through the Typesense document the
 * search sync already computed it into — see buildSearchDocument's
 * sellerRatingAvg/sellerRatingCount params. This is a "nice to have" overlay:
 * if a listing hasn't reached the index yet, its offer row just renders
 * without a rating rather than blocking the page.
 */
export function useOfferRatings(partId: string | undefined) {
  return useQuery({
    queryKey: ['offer-ratings', partId],
    queryFn: async (): Promise<Record<string, SearchListingDocument>> => {
      if (!partId) return {}
      const client = await getSearchClient()
      const result = await client.collections(SEARCH_COLLECTION_NAME).documents().search({
        q: '*',
        query_by: 'title',
        filter_by: `partId:=\`${partId}\``,
        per_page: 250,
      })

      const byListingId: Record<string, SearchListingDocument> = {}
      for (const hit of result.hits ?? []) {
        const parsed = searchListingDocumentSchema.safeParse(hit.document)
        if (parsed.success) byListingId[parsed.data.listingId] = parsed.data
      }
      return byListingId
    },
    enabled: Boolean(partId),
    staleTime: 30_000,
  })
}
