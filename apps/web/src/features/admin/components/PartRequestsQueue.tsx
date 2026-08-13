import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { EmptyState } from '@/components/states/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import { usePendingPartRequests } from '@/features/admin/api/partRequestActions'
import { cn } from '@/lib/utils'

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-signal/10 text-signal',
  under_review: 'bg-ink/10 text-ink',
}

export function PartRequestsQueue() {
  const { t } = useTranslation()
  const { requests, loading } = usePendingPartRequests()

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    )
  }

  if (requests.length === 0) {
    return (
      <EmptyState
        title={t('admin.partRequests.emptyTitle')}
        description={t('admin.partRequests.emptyDescription')}
      />
    )
  }

  return (
    <ul className="space-y-2">
      {requests.map((request) => (
        <li key={request.id}>
          <Link
            to={`/admin/part-requests/${request.id}`}
            className="flex items-center justify-between gap-3 rounded-[6px] border border-steel/20 p-4 hover:bg-surface-muted"
          >
            <div>
              <p className="font-medium text-ink">{request.title}</p>
              <p className="text-xs text-steel">{request.brand ?? request.categorySlug}</p>
            </div>
            <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_STYLES[request.status])}>
              {t(`sellerListings.partRequest.status.${request.status}`)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
