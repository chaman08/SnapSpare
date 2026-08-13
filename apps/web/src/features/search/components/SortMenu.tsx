import { useTranslation } from 'react-i18next'
import type { SearchSortOption } from '../types'

interface SortMenuProps {
  value: SearchSortOption
  onChange: (value: SearchSortOption) => void
}

const OPTIONS: SearchSortOption[] = ['relevance', 'price_asc', 'delivery', 'rating']

export function SortMenu({ value, onChange }: SortMenuProps) {
  const { t } = useTranslation()

  return (
    <label className="flex items-center gap-2 text-sm text-ink">
      <span className="hidden text-steel sm:inline">{t('search.sortBy')}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as SearchSortOption)}
        aria-label={t('search.sortBy')}
        className="min-h-tap rounded-[6px] border border-steel/30 bg-surface px-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
      >
        {OPTIONS.map((option) => (
          <option key={option} value={option}>
            {t(`search.sort.${option}`)}
          </option>
        ))}
      </select>
    </label>
  )
}
