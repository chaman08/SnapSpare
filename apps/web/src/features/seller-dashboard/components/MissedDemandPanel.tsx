import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/components/states/EmptyState'
import { ErrorState } from '@/components/states/ErrorState'
import { Skeleton } from '@/components/ui/skeleton'
import { useMissedDemand } from '@/features/seller-dashboard/api/missedDemand'

interface MissedDemandPanelProps {
  sellerId: string | undefined
}

/** Requirement 6's "missed demand" panel — buyer searches in this seller's categories that returned nothing, so they can decide whether to add that part. */
export function MissedDemandPanel({ sellerId }: MissedDemandPanelProps) {
  const { t } = useTranslation()
  const { data: items, isLoading, isError, refetch } = useMissedDemand(sellerId)

  return (
    <section className="rounded-[6px] border border-steel/20 bg-surface p-4" aria-labelledby="missed-demand-heading">
      <h2 id="missed-demand-heading" className="font-heading text-lg font-semibold text-ink">
        {t('sellerDashboard.missedDemand.title')}
      </h2>
      <p className="mt-1 text-xs text-steel">{t('sellerDashboard.missedDemand.description')}</p>

      <div className="mt-3">
        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : !items || items.length === 0 ? (
          <EmptyState title={t('sellerDashboard.missedDemand.emptyTitle')} />
        ) : (
          <ul className="divide-y divide-steel/10">
            {items.map((item) => (
              <li key={item.normalizedQuery} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span className="truncate text-ink">{item.sampleQuery}</span>
                <span className="shrink-0 font-mono text-steel">{item.count}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
