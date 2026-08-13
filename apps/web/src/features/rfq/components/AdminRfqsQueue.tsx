import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { EmptyState } from '@/components/states/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import { RfqStatusPill } from '@/features/rfq/components/RfqStatusPill'
import { groupDemandByCategorySlug, useAdminRfqs } from '@/features/rfq/api/useAdminRfqs'

/** Requirement 7: admin view of all RFQs, plus a demand-by-category rollup for RFQs with no catalogue partId — "spot demand for parts the catalogue is missing". */
export function AdminRfqsQueue() {
  const { t } = useTranslation()
  const { rfqs, loading } = useAdminRfqs()
  const demandGroups = groupDemandByCategorySlug(rfqs)

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {demandGroups.length > 0 ? (
        <div>
          <h2 className="mb-2 font-heading text-lg font-semibold text-ink">{t('admin.rfqs.demandTitle')}</h2>
          <ul className="space-y-1.5">
            {demandGroups.map((group) => (
              <li key={group.categorySlug} className="flex items-center justify-between rounded-[6px] border border-steel/20 px-3 py-2 text-sm">
                <span className="text-ink">{group.categorySlug}</span>
                <span className="font-mono text-steel">{group.count}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div>
        <h2 className="mb-2 font-heading text-lg font-semibold text-ink">{t('admin.rfqs.allTitle')}</h2>
        {rfqs.length === 0 ? (
          <EmptyState title={t('admin.rfqs.emptyTitle')} />
        ) : (
          <ul className="space-y-2">
            {rfqs.map((rfq) => (
              <li key={rfq.id}>
                <Link
                  to={`/admin/rfqs/${rfq.id}`}
                  className="flex items-center justify-between gap-3 rounded-[6px] border border-steel/20 p-4 hover:bg-surface-muted"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{rfq.freeTextDescription ?? rfq.partId ?? t('rfq.list.untitled')}</p>
                    <p className="text-xs text-steel">{rfq.categorySlug ?? '—'}</p>
                  </div>
                  <RfqStatusPill status={rfq.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
