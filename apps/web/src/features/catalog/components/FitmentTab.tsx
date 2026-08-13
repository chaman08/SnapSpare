import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/components/states/EmptyState'
import { ErrorState } from '@/components/states/ErrorState'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useCatalogFitmentsForPart } from '@/features/catalog/api/useCatalogFitmentsForPart'

interface FitmentTabProps {
  partId: string
}

/** Full, searchable list of vehicles this part is verified to fit — the detail behind the above-the-fold FitmentBadge, which only checks the buyer's own active vehicle. */
export function FitmentTab({ partId }: FitmentTabProps) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const fitmentsQuery = useCatalogFitmentsForPart(partId)
  const rows = fitmentsQuery.data ?? []

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    const data = fitmentsQuery.data ?? []
    if (!term) return data
    return data.filter((row) =>
      `${row.makeName} ${row.modelName} ${row.variantName ?? ''}`.toLowerCase().includes(term),
    )
  }, [fitmentsQuery.data, search])

  if (fitmentsQuery.isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (fitmentsQuery.isError) {
    return <ErrorState onRetry={() => fitmentsQuery.refetch()} />
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        title={t('product.detail.fitment.emptyTitle')}
        description={t('product.detail.fitment.emptyDescription')}
      />
    )
  }

  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="fitment-search" className="sr-only">
          {t('product.detail.fitment.searchLabel')}
        </Label>
        <Input
          id="fitment-search"
          type="search"
          placeholder={t('product.detail.fitment.searchLabel')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <p className="py-6 text-center text-sm text-steel">{t('search.zeroResults.title')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-steel/20 text-xs text-steel">
                <th scope="col" className="py-2 pr-4 font-medium">{t('product.detail.fitment.make')}</th>
                <th scope="col" className="py-2 pr-4 font-medium">{t('product.detail.fitment.model')}</th>
                <th scope="col" className="py-2 pr-4 font-medium">{t('product.detail.fitment.variant')}</th>
                <th scope="col" className="py-2 font-medium">{t('product.detail.fitment.years')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} className="border-b border-steel/10">
                  <td className="py-2 pr-4 text-ink">{row.makeName}</td>
                  <td className="py-2 pr-4 text-ink">{row.modelName}</td>
                  <td className="py-2 pr-4 text-steel">{row.variantName ?? t('product.detail.fitment.allVariants')}</td>
                  <td className="py-2 font-mono text-xs text-steel">
                    {row.yearFrom ? `${row.yearFrom}–${row.yearTo ?? t('product.detail.fitment.present')}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
