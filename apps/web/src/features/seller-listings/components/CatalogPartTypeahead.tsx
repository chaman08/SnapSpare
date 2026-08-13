import type { SearchCatalogPartDocument } from '@snapspare/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useCatalogPartSearch } from '@/features/seller-listings/api/useCatalogPartSearch'
import { useDebouncedValue } from '@/features/search/lib/useDebouncedValue'

const MIN_QUERY_LENGTH = 2
const DEBOUNCE_MS = 250

interface CatalogPartTypeaheadProps {
  onSelect: (part: SearchCatalogPartDocument) => void
  onRequestNewPart: () => void
}

/** Search-by-part-number/name/brand typeahead for the "Add listing" flow's first step — searches the `catalog_parts` Typesense collection (seller-only, see api/searchCatalogParts.ts), not the buyer-facing `listings` collection. */
export function CatalogPartTypeahead({ onSelect, onRequestNewPart }: CatalogPartTypeaheadProps) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebouncedValue(query, DEBOUNCE_MS)
  const { data: parts, isFetching } = useCatalogPartSearch(debouncedQuery)

  const trimmed = debouncedQuery.trim()
  const showResults = trimmed.length >= MIN_QUERY_LENGTH

  return (
    <div className="space-y-3">
      <div>
        <h2 className="font-heading text-lg font-semibold text-ink">{t('sellerListings.addFlow.step1Title')}</h2>
        <p className="text-sm text-steel">{t('sellerListings.addFlow.step1Description')}</p>
      </div>

      <Input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t('sellerListings.addFlow.searchPlaceholder')}
        aria-label={t('sellerListings.addFlow.searchPlaceholder')}
      />

      {!showResults ? (
        <p className="text-sm text-steel">{t('sellerListings.addFlow.searchMinChars')}</p>
      ) : isFetching ? (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : (parts?.length ?? 0) === 0 ? (
        <div className="space-y-2 rounded-[6px] border border-dashed border-steel/30 p-4 text-center">
          <p className="text-sm text-steel">{t('sellerListings.addFlow.noResults')}</p>
          <button
            type="button"
            onClick={onRequestNewPart}
            className="min-h-tap text-sm font-medium text-signal underline-offset-2 hover:underline"
          >
            {t('sellerListings.addFlow.requestNewPart')}
          </button>
        </div>
      ) : (
        <ul className="space-y-2">
          {parts?.map((part) => (
            <li key={part.id}>
              <button
                type="button"
                onClick={() => onSelect(part)}
                className="flex w-full min-h-tap items-center gap-3 rounded-[6px] border border-steel/20 p-3 text-left hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
              >
                {part.imageUrl ? (
                  <img src={part.imageUrl} alt="" className="h-12 w-12 shrink-0 rounded-[6px] object-cover" />
                ) : (
                  <div className="h-12 w-12 shrink-0 rounded-[6px] bg-steel/10" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink">{part.name}</p>
                  <p className="truncate text-xs text-steel">
                    {part.brand ? `${part.brand} · ` : ''}
                    <span className="font-mono">{part.partNumber}</span>
                  </p>
                </div>
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={onRequestNewPart}
              className="min-h-tap text-sm font-medium text-signal underline-offset-2 hover:underline"
            >
              {t('sellerListings.addFlow.requestNewPart')}
            </button>
          </li>
        </ul>
      )}
    </div>
  )
}
