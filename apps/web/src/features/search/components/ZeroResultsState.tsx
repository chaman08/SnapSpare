import { CATEGORY_TREE } from '@snapspare/shared'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/api/AuthProvider'
import { RfqDialog } from '@/features/rfq/components/RfqDialog'
import { logSearchMiss } from '../api/logSearchMiss'
import type { SearchFilters } from '../types'

interface ZeroResultsStateProps {
  query: string
  filters: SearchFilters
  onRemoveFitmentFilter: () => void
}

/**
 * Empty state for a zero-result search/category page. Logs the miss exactly
 * once per distinct (query, filters) render — see logSearchMiss's doc
 * comment for why this collection matters (it's the seller-acquisition /
 * catalogue-gap report).
 */
export function ZeroResultsState({ query, filters, onRemoveFitmentFilter }: ZeroResultsStateProps) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [requestOpen, setRequestOpen] = useState(false)
  const loggedKeyRef = useRef<string>('')

  useEffect(() => {
    const key = `${query}::${JSON.stringify(filters)}`
    if (loggedKeyRef.current === key) return
    loggedKeyRef.current = key
    void logSearchMiss({ query, filters, userId: user?.uid })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-log when query/filters actually change, not on every user identity refresh
  }, [query, filters])

  const relatedCategories = filters.category
    ? (CATEGORY_TREE.find((c) => c.slug === filters.category)?.subcategories ?? []).slice(0, 6)
    : CATEGORY_TREE.slice(0, 6)

  return (
    <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
      <p className="font-heading text-lg font-semibold text-ink">{t('search.zeroResults.title')}</p>
      <p className="max-w-sm text-sm text-steel">{t('search.zeroResults.description')}</p>

      {filters.fitsMyVehicle && filters.vehicleModelId ? (
        <Button type="button" variant="outline" size="sm" onClick={onRemoveFitmentFilter}>
          {t('search.zeroResults.removeFitmentFilter')}
        </Button>
      ) : null}

      {relatedCategories.length > 0 ? (
        <div className="w-full max-w-md">
          <p className="mb-2 text-sm font-medium text-ink">{t('search.zeroResults.relatedCategories')}</p>
          <div className="flex flex-wrap justify-center gap-2">
            {relatedCategories.map((category) => (
              <Link
                key={category.slug}
                to={filters.category ? `/parts/${filters.category}/${category.slug}` : `/parts/${category.slug}`}
                className="min-h-tap rounded-full border border-steel/20 px-3 py-1.5 text-sm text-ink hover:bg-surface-muted"
              >
                {category.name}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <Button type="button" variant="cta" onClick={() => setRequestOpen(true)}>
        {t('search.zeroResults.requestPart')}
      </Button>

      <RfqDialog
        open={requestOpen}
        onClose={() => setRequestOpen(false)}
        defaultDescription={query}
        defaultCategorySlug={filters.category}
      />
    </div>
  )
}
