import { SlidersHorizontal, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { EMPTY_SEARCH_FILTERS, hasActiveFilters, type SearchFilters } from '../types'
import { FacetControls } from './FacetControls'

interface FilterSheetProps {
  filters: SearchFilters
  facetCounts: Record<string, Record<string, number>>
  onChange: (next: SearchFilters) => void
  resultCount: number
}

/** Mobile-only (below md) filter trigger + bottom sheet — same FacetControls body as the desktop FacetSidebar. */
export function FilterSheet({ filters, facetCounts, onChange, resultCount }: FilterSheetProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(filters)

  useEffect(() => {
    if (open) setDraft(filters)
  }, [open, filters])

  useEffect(() => {
    if (!open) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  return (
    <div className="md:hidden">
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-2">
        <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
        {t('search.filters')}
        {hasActiveFilters(filters) ? (
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-signal text-[10px] text-ink">
            •
          </span>
        ) : null}
      </Button>

      {open ? (
        <>
          <div className="fixed inset-0 z-40 bg-ink/40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t('search.filters')}
            className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col rounded-t-[6px] border-t border-steel/20 bg-surface"
          >
            <div className="flex items-center justify-between border-b border-steel/10 p-4">
              <p className="font-heading text-lg font-semibold text-ink">{t('search.filters')}</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t('common.close')}
                className="flex min-h-tap min-w-tap items-center justify-center rounded-[6px] text-ink hover:bg-surface-muted"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <FacetControls filters={draft} facetCounts={facetCounts} onChange={setDraft} />
            </div>

            <div className="flex gap-2 border-t border-steel/10 p-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() =>
                  setDraft({
                    ...EMPTY_SEARCH_FILTERS,
                    category: filters.category,
                    subCategory: filters.subCategory,
                    vehicleModelId: filters.vehicleModelId,
                  })
                }
              >
                {t('search.clearFilters')}
              </Button>
              <Button
                type="button"
                variant="cta"
                className="flex-1"
                onClick={() => {
                  onChange(draft)
                  setOpen(false)
                }}
              >
                {t('search.showResults', { count: resultCount })}
              </Button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
