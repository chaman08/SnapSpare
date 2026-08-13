import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { SearchResultsGrid } from '@/features/search/components/SearchResultsGrid'
import { EMPTY_SEARCH_FILTERS, type SearchFilters, type SearchSortOption } from '@/features/search/types'
import { useActiveVehicleStore } from '@/stores/activeVehicleStore'

export default function SearchResultsPage() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const query = searchParams.get('q') ?? ''
  const makeIdParam = searchParams.get('makeId') ?? undefined
  const activeVehicle = useActiveVehicleStore((state) => state.activeVehicle)

  const [filters, setFilters] = useState<SearchFilters>({
    ...EMPTY_SEARCH_FILTERS,
    vehicleModelId: activeVehicle?.modelId,
    vehicleMakeId: makeIdParam,
  })
  const [sort, setSort] = useState<SearchSortOption>('relevance')

  // Keep the fits-my-vehicle filter pointed at whichever vehicle is
  // currently active — switching vehicles mid-browse shouldn't require
  // leaving the results page.
  useEffect(() => {
    setFilters((prev) => ({ ...prev, vehicleModelId: activeVehicle?.modelId }))
  }, [activeVehicle?.modelId])

  useEffect(() => {
    setFilters((prev) => ({ ...prev, vehicleMakeId: makeIdParam }))
  }, [makeIdParam])

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="mb-4 font-heading text-2xl font-semibold text-ink">
        {query ? t('search.resultsForQuery', { query }) : t('search.allResults')}
      </h1>

      <SearchResultsGrid query={query} filters={filters} onFiltersChange={setFilters} sort={sort} onSortChange={setSort} />
    </div>
  )
}
