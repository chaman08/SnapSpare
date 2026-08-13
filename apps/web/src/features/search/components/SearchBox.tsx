import { Search, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useRecentSearchesStore } from '@/stores/recentSearchesStore'
import type { CategorySuggestion, VehicleSuggestion } from '../api/useSearchSuggestions'
import { useDebouncedValue } from '../lib/useDebouncedValue'
import { SearchSuggestions } from './SearchSuggestions'

/**
 * Instant-search box mounted in the header's searchSlot. Debounces the query
 * driving the suggestions dropdown; submitting (Enter, or picking a
 * suggestion) always navigates to /search — the results page owns the real,
 * un-debounced Typesense query and pagination.
 */
export function SearchBox() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const debouncedQuery = useDebouncedValue(query, 250)
  const containerRef = useRef<HTMLDivElement>(null)
  const recentSearches = useRecentSearchesStore((state) => state.queries)
  const addRecentQuery = useRecentSearchesStore((state) => state.addQuery)

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function runSearch(q: string) {
    const trimmed = q.trim()
    if (!trimmed) return
    addRecentQuery(trimmed)
    setQuery(trimmed)
    setOpen(false)
    navigate(`/search?q=${encodeURIComponent(trimmed)}`)
  }

  function goToCategory(category: CategorySuggestion) {
    setOpen(false)
    setQuery('')
    navigate(
      category.subCategorySlug
        ? `/parts/${category.categorySlug}/${category.subCategorySlug}`
        : `/parts/${category.categorySlug}`,
    )
  }

  function goToVehicle(vehicle: VehicleSuggestion) {
    setOpen(false)
    setQuery('')
    navigate(`/search?makeId=${encodeURIComponent(vehicle.makeId)}`)
  }

  return (
    <div ref={containerRef} className="relative">
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault()
          runSearch(query)
        }}
      >
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-steel"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => setOpen(true)}
            placeholder={t('header.searchPlaceholder')}
            aria-label={t('header.searchPlaceholder')}
            className="min-h-tap w-full rounded-[6px] border border-steel/30 bg-surface py-2 pl-9 pr-9 text-base text-ink placeholder:text-steel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label={t('common.close')}
              className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-steel hover:bg-surface-muted"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </form>

      {open ? (
        <div className="absolute inset-x-0 top-full z-50 mt-1 rounded-[6px] border border-steel/20 bg-surface shadow-lg">
          <SearchSuggestions
            query={debouncedQuery}
            recentSearches={recentSearches}
            onSelectQuery={runSearch}
            onSelectCategory={goToCategory}
            onSelectVehicle={goToVehicle}
          />
        </div>
      ) : null}
    </div>
  )
}
