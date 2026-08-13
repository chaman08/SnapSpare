import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const MAX_RECENT_SEARCHES = 8

interface RecentSearchesState {
  queries: string[]
  addQuery: (query: string) => void
  clear: () => void
}

/** Buyer's own recent search terms, persisted locally (never synced server-side — there's no cross-device account requirement for this in Phase 5). Most-recent-first, deduped case-insensitively. */
export const useRecentSearchesStore = create<RecentSearchesState>()(
  persist(
    (set) => ({
      queries: [],
      addQuery: (query) =>
        set((state) => {
          const trimmed = query.trim()
          if (!trimmed) return state
          const withoutDuplicate = state.queries.filter((q) => q.toLowerCase() !== trimmed.toLowerCase())
          return { queries: [trimmed, ...withoutDuplicate].slice(0, MAX_RECENT_SEARCHES) }
        }),
      clear: () => set({ queries: [] }),
    }),
    { name: 'snapspare-recent-searches' },
  ),
)
