import type { SearchListingDocument } from '@snapspare/shared'
import { coOccurrenceConverter, searchListingDocumentSchema } from '@snapspare/shared'
import { useQuery } from '@tanstack/react-query'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { getSearchClient, SEARCH_COLLECTION_NAME } from '@/features/search/api/searchClient'
import { clientConverter } from '@/lib/firestoreConverter'

const RAIL_SIZE = 8

/** One representative (most popular) active listing per partId, in the same order as `partIds` — that order already encodes the co-occurrence ranking, which Typesense's own relevance sort would just discard. */
async function fetchRepresentativeListings(partIds: string[]): Promise<SearchListingDocument[]> {
  if (partIds.length === 0) return []

  const client = await getSearchClient()
  const result = await client
    .collections(SEARCH_COLLECTION_NAME)
    .documents()
    .search({
      q: '*',
      query_by: 'title',
      filter_by: `partId:=[${partIds.map((id) => `\`${id}\``).join(',')}]`,
      per_page: 250,
    })

  const byPartId = new Map<string, SearchListingDocument>()
  for (const hit of result.hits ?? []) {
    const parsed = searchListingDocumentSchema.safeParse(hit.document)
    if (!parsed.success) continue
    const existing = byPartId.get(parsed.data.partId)
    if (!existing || parsed.data.popularityScore > existing.popularityScore) {
      byPartId.set(parsed.data.partId, parsed.data)
    }
  }

  return partIds
    .map((id) => byPartId.get(id))
    .filter((listing): listing is SearchListingDocument => Boolean(listing))
}

export interface RelatedParts {
  boughtTogether: SearchListingDocument[]
  alsoViewed: SearchListingDocument[]
}

/** Backs "Frequently bought together" and "Others also viewed" from the same simple pairwise coOccurrence doc — see its schema comment for how each half is populated. */
export function useRelatedParts(partId: string | undefined) {
  return useQuery({
    queryKey: ['related-parts', partId],
    queryFn: async (): Promise<RelatedParts> => {
      if (!partId) return { boughtTogether: [], alsoViewed: [] }

      const snapshot = await getDoc(
        doc(db, 'coOccurrence', partId).withConverter(clientConverter(coOccurrenceConverter)),
      )
      const coOccurrence = snapshot.exists() ? snapshot.data() : undefined

      const rankedIds = (counts: Record<string, number> | undefined) =>
        Object.entries(counts ?? {})
          .sort((a, b) => b[1] - a[1])
          .slice(0, RAIL_SIZE)
          .map(([id]) => id)

      const [boughtTogether, alsoViewed] = await Promise.all([
        fetchRepresentativeListings(rankedIds(coOccurrence?.boughtWith)),
        fetchRepresentativeListings(rankedIds(coOccurrence?.viewedWith)),
      ])

      return { boughtTogether, alsoViewed }
    },
    enabled: Boolean(partId),
    staleTime: 60_000,
  })
}
