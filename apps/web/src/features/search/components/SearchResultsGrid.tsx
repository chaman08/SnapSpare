import { looksLikePartNumber } from '@snapspare/shared'
import { CheckCircle2 } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { ErrorState } from '@/components/states/ErrorState'
import { VirtualizedGrid } from '@/components/virtual/VirtualizedGrid'
import { ProductCard } from '@/features/catalog/components/ProductCard'
import { ProductCardSkeleton } from '@/features/catalog/components/ProductCardSkeleton'
import { useSearchListings } from '../api/useSearchListings'
import type { SearchFilters, SearchSortOption } from '../types'
import { FacetSidebar } from './FacetSidebar'
import { FilterSheet } from './FilterSheet'
import { SortMenu } from './SortMenu'
import { ZeroResultsState } from './ZeroResultsState'

const SKELETON_COUNT = 12

interface SearchResultsGridProps {
  query: string
  filters: SearchFilters
  onFiltersChange: (next: SearchFilters) => void
  sort: SearchSortOption
  onSortChange: (next: SearchSortOption) => void
}

/**
 * Shared body — facet sidebar/filter sheet, sort, result grid with infinite
 * scroll, loading/error/zero states — used by both the free-text search
 * results page and category browse pages (which just supply category/
 * subCategory/vehicleModelId filters and an empty query instead of typed
 * text; useSearchListings treats an empty query as Typesense's `q: '*'`).
 */
export function SearchResultsGrid({ query, filters, onFiltersChange, sort, onSortChange }: SearchResultsGridProps) {
  const { t } = useTranslation()
  const searchQuery = useSearchListings({ query, filters, sort })

  const pages = searchQuery.data?.pages
  const documents = useMemo(() => pages?.flatMap((page) => page.documents) ?? [], [pages])
  const found = pages?.[0]?.found ?? 0
  const facetCounts = pages?.[0]?.facetCounts ?? {}

  function handleEndReached() {
    if (searchQuery.hasNextPage && !searchQuery.isFetchingNextPage) {
      void searchQuery.fetchNextPage()
    }
  }

  const isPartNumberQuery = looksLikePartNumber(query)
  const exactMatch =
    isPartNumberQuery &&
    documents.find((doc) => {
      const q = query.trim().toLowerCase()
      return (
        doc.partNumber.toLowerCase() === q ||
        doc.oemNumbers.some((n) => n.toLowerCase() === q) ||
        doc.crossRefNumbers.some((n) => n.toLowerCase() === q)
      )
    })

  return (
    <div>
      {exactMatch ? (
        <div className="mb-4 flex items-center gap-2 rounded-[6px] bg-verify/10 px-4 py-2 text-sm font-medium text-verify">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          {t('search.exactMatch', { partNumber: exactMatch.partNumber })}
        </div>
      ) : null}

      <div className="flex flex-col gap-6 md:flex-row">
        <FacetSidebar filters={filters} facetCounts={facetCounts} onChange={onFiltersChange} />

        <div className="min-w-0 flex-1">
          <div className="mb-4 flex items-center justify-between gap-3">
            <FilterSheet filters={filters} facetCounts={facetCounts} onChange={onFiltersChange} resultCount={found} />
            <SortMenu value={sort} onChange={onSortChange} />
          </div>

          {searchQuery.isError ? (
            <ErrorState onRetry={() => searchQuery.refetch()} />
          ) : searchQuery.isLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          ) : documents.length === 0 ? (
            <ZeroResultsState
              query={query}
              filters={filters}
              onRemoveFitmentFilter={() => onFiltersChange({ ...filters, fitsMyVehicle: false })}
            />
          ) : (
            <>
              <p className="mb-3 text-sm text-steel" aria-live="polite">
                {t('search.showingCount', { shown: documents.length, total: found })}
              </p>
              <VirtualizedGrid
                items={documents}
                columns={{ base: 2, sm: 3, lg: 4 }}
                rowHeight={420}
                height={900}
                onEndReached={handleEndReached}
                renderItem={(doc, index) => (
                  <ProductCard key={doc.listingId} listing={doc} priorityImage={index < 4} />
                )}
              />
              {searchQuery.isFetchingNextPage ? (
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <ProductCardSkeleton key={i} />
                  ))}
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
