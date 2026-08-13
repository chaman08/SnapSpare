import { Clock, TrendingUp } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchSuggestions } from '../api/useSearchSuggestions'
import { TRENDING_SEARCHES } from '../lib/trendingSearches'
import type { CategorySuggestion, VehicleSuggestion } from '../api/useSearchSuggestions'

interface SearchSuggestionsProps {
  query: string
  recentSearches: string[]
  onSelectQuery: (query: string) => void
  onSelectCategory: (category: CategorySuggestion) => void
  onSelectVehicle: (vehicle: VehicleSuggestion) => void
}

function SuggestionGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-b border-steel/10 py-2 last:border-b-0">
      <p className="px-4 pb-1 text-xs font-semibold uppercase tracking-wide text-steel">{label}</p>
      {children}
    </div>
  )
}

function SuggestionButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-tap w-full items-center gap-2 px-4 text-left text-sm text-ink hover:bg-surface-muted"
    >
      {children}
    </button>
  )
}

/** Dropdown content for SearchBox — recent/trending when the box is empty, live grouped suggestions (Parts/Brands/Categories/Vehicles) once the buyer starts typing. */
export function SearchSuggestions({
  query,
  recentSearches,
  onSelectQuery,
  onSelectCategory,
  onSelectVehicle,
}: SearchSuggestionsProps) {
  const { t } = useTranslation()
  const trimmed = query.trim()
  const suggestions = useSearchSuggestions(trimmed)

  if (trimmed.length < 2) {
    if (recentSearches.length === 0 && TRENDING_SEARCHES.length === 0) return null
    return (
      <div className="max-h-[70vh] overflow-y-auto py-2">
        {recentSearches.length > 0 ? (
          <SuggestionGroup label={t('search.recent')}>
            {recentSearches.map((recent) => (
              <SuggestionButton key={recent} onClick={() => onSelectQuery(recent)}>
                <Clock className="h-4 w-4 shrink-0 text-steel" aria-hidden="true" />
                {recent}
              </SuggestionButton>
            ))}
          </SuggestionGroup>
        ) : null}
        <SuggestionGroup label={t('search.trending')}>
          {TRENDING_SEARCHES.map((trending) => (
            <SuggestionButton key={trending} onClick={() => onSelectQuery(trending)}>
              <TrendingUp className="h-4 w-4 shrink-0 text-steel" aria-hidden="true" />
              {trending}
            </SuggestionButton>
          ))}
        </SuggestionGroup>
      </div>
    )
  }

  const hasAny =
    suggestions.parts.length > 0 ||
    suggestions.brands.length > 0 ||
    suggestions.categories.length > 0 ||
    suggestions.vehicles.length > 0

  if (!hasAny && !suggestions.isLoading) {
    return (
      <div className="px-4 py-6 text-center text-sm text-steel">{t('vehicleSelector.noResults')}</div>
    )
  }

  return (
    <div className="max-h-[70vh] overflow-y-auto py-2">
      {suggestions.parts.length > 0 ? (
        <SuggestionGroup label={t('search.groupParts')}>
          {suggestions.parts.map((part) => (
            <SuggestionButton key={part.listingId} onClick={() => onSelectQuery(part.title)}>
              {part.imageUrl ? (
                <img src={part.imageUrl} alt="" className="h-6 w-6 shrink-0 rounded-[4px] object-cover" />
              ) : (
                <span className="h-6 w-6 shrink-0 rounded-[4px] bg-surface-muted" aria-hidden="true" />
              )}
              <span className="truncate">{part.title}</span>
            </SuggestionButton>
          ))}
        </SuggestionGroup>
      ) : null}

      {suggestions.brands.length > 0 ? (
        <SuggestionGroup label={t('search.groupBrands')}>
          {suggestions.brands.map((brand) => (
            <SuggestionButton key={brand} onClick={() => onSelectQuery(brand)}>
              {brand}
            </SuggestionButton>
          ))}
        </SuggestionGroup>
      ) : null}

      {suggestions.categories.length > 0 ? (
        <SuggestionGroup label={t('search.groupCategories')}>
          {suggestions.categories.map((category) => (
            <SuggestionButton
              key={`${category.categorySlug}-${category.subCategorySlug ?? ''}`}
              onClick={() => onSelectCategory(category)}
            >
              {category.label}
            </SuggestionButton>
          ))}
        </SuggestionGroup>
      ) : null}

      {suggestions.vehicles.length > 0 ? (
        <SuggestionGroup label={t('search.groupVehicles')}>
          {suggestions.vehicles.map((vehicle) => (
            <SuggestionButton key={vehicle.makeId} onClick={() => onSelectVehicle(vehicle)}>
              {vehicle.logoUrl ? (
                <img src={vehicle.logoUrl} alt="" className="h-5 w-5 shrink-0 object-contain" />
              ) : null}
              {vehicle.name}
            </SuggestionButton>
          ))}
        </SuggestionGroup>
      ) : null}
    </div>
  )
}
