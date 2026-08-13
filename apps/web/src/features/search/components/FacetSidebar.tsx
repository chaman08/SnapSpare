import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { EMPTY_SEARCH_FILTERS, hasActiveFilters, type SearchFilters } from '../types'
import { FacetControls } from './FacetControls'

interface FacetSidebarProps {
  filters: SearchFilters
  facetCounts: Record<string, Record<string, number>>
  onChange: (next: SearchFilters) => void
}

/** Desktop-only (md+) facet sidebar — see FilterSheet for the mobile equivalent, which shares FacetControls. */
export function FacetSidebar({ filters, facetCounts, onChange }: FacetSidebarProps) {
  const { t } = useTranslation()

  return (
    <aside className="hidden w-64 shrink-0 md:block">
      <div className="mb-3 flex items-center justify-between">
        <p className="font-heading text-lg font-semibold text-ink">{t('search.filters')}</p>
        {hasActiveFilters(filters) ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange({ ...EMPTY_SEARCH_FILTERS, category: filters.category, subCategory: filters.subCategory, vehicleModelId: filters.vehicleModelId })}
          >
            {t('search.clearFilters')}
          </Button>
        ) : null}
      </div>
      <FacetControls filters={filters} facetCounts={facetCounts} onChange={onChange} />
    </aside>
  )
}
