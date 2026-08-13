import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const MAX_RECENTLY_VIEWED = 20

interface RecentlyViewedState {
  listingIds: string[]
  addViewed: (listingId: string) => void
}

/** Buyer's own recently-viewed listings, persisted locally only — same "no cross-device sync needed yet" call as recentSearchesStore.ts. Most-recent-first, deduped. */
export const useRecentlyViewedStore = create<RecentlyViewedState>()(
  persist(
    (set) => ({
      listingIds: [],
      addViewed: (listingId) =>
        set((state) => {
          const withoutDuplicate = state.listingIds.filter((id) => id !== listingId)
          return { listingIds: [listingId, ...withoutDuplicate].slice(0, MAX_RECENTLY_VIEWED) }
        }),
    }),
    { name: 'snapspare-recently-viewed' },
  ),
)
