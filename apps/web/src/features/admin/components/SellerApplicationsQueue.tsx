import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { EmptyState } from '@/components/states/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import { usePendingSellerApplications } from '@/features/admin/api/sellerApplicationActions'
import { cn } from '@/lib/utils'

const STATUS_STYLES: Record<string, string> = {
  submitted: 'bg-signal/10 text-signal',
  under_review: 'bg-ink/10 text-ink',
}

export function SellerApplicationsQueue() {
  const { t } = useTranslation()
  const { applications, loading } = usePendingSellerApplications()

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    )
  }

  if (applications.length === 0) {
    return <EmptyState title={t('admin.sellerApplications.emptyTitle')} description={t('admin.sellerApplications.emptyDescription')} />
  }

  return (
    <ul className="space-y-2">
      {applications.map((application) => (
        <li key={application.id}>
          <Link
            to={`/admin/seller-applications/${application.id}`}
            className="flex items-center justify-between gap-3 rounded-[6px] border border-steel/20 p-4 hover:bg-surface-muted"
          >
            <div>
              <p className="font-medium text-ink">{application.business?.tradeName ?? application.ownerUserId}</p>
              <p className="text-xs text-steel">{application.business?.legalName}</p>
            </div>
            <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_STYLES[application.status])}>
              {t(`sell.tracker.step.${application.status}`, { defaultValue: application.status })}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
