import { bulkBuySpotlightDocSchema } from '@snapspare/shared'
import { useQuery } from '@tanstack/react-query'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

/**
 * Merges the admin's pinned listings ahead of the daily-computed
 * biggest-slab-savings ranking (see computeBulkBuySpotlight.ts), capped to
 * the section's `maxItems`. Pinned entries always win a slot even if their
 * discount doesn't rank in the top computed set.
 */
export function useBulkBuySpotlightListingIds(pinnedListingIds: string[], maxItems: number) {
  return useQuery({
    queryKey: ['bulk-buy-spotlight-computed'],
    queryFn: async (): Promise<string[]> => {
      const snapshot = await getDoc(doc(db, 'homepageComputed', 'bulkBuySpotlight'))
      if (!snapshot.exists()) return []
      const parsed = bulkBuySpotlightDocSchema.safeParse(snapshot.data())
      return parsed.success ? parsed.data.listingIds : []
    },
    staleTime: 5 * 60_000,
    select: (computedIds) => {
      const merged = [...pinnedListingIds, ...computedIds.filter((id) => !pinnedListingIds.includes(id))]
      return merged.slice(0, maxItems)
    },
  })
}
