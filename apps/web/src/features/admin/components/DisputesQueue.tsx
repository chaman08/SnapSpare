import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { EmptyState } from '@/components/states/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import { useOpenDisputes } from '@/features/admin/api/disputeActions'
import { cn } from '@/lib/utils'

export function DisputesQueue() {
  const { t } = useTranslation()
  const { disputes, loading } = useOpenDisputes()

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    )
  }

  if (disputes.length === 0) {
    return <EmptyState title={t('admin.disputes.emptyTitle')} description={t('admin.disputes.emptyDescription')} />
  }

  return (
    <ul className="space-y-2">
      {disputes.map((dispute) => {
        const hoursLeft = Math.max(0, Math.round((dispute.slaBreachAt - Date.now()) / (60 * 60_000)))
        return (
          <li key={dispute.id}>
            <Link
              to={`/admin/disputes/${dispute.id}`}
              className="flex items-center justify-between gap-3 rounded-[6px] border border-steel/20 p-4 hover:bg-surface-muted"
            >
              <div>
                <p className="font-mono text-sm text-ink">{dispute.subOrderId}</p>
                <p className="line-clamp-1 text-xs text-steel">{dispute.reasonNotes}</p>
              </div>
              <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', hoursLeft <= 6 ? 'bg-alert/10 text-alert' : 'bg-ink/10 text-ink')}>
                {hoursLeft}h
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
