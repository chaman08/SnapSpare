import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { EmptyState } from '@/components/states/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import { usePendingSpuriousReports } from '@/features/admin/api/spuriousReportActions'
import { cn } from '@/lib/utils'

const STATUS_STYLES: Record<string, string> = {
  submitted: 'bg-alert/10 text-alert',
  under_review: 'bg-ink/10 text-ink',
  seller_responded: 'bg-signal/10 text-signal',
}

export function SpuriousReportsQueue() {
  const { t } = useTranslation()
  const { reports, loading } = usePendingSpuriousReports()

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    )
  }

  if (reports.length === 0) {
    return <EmptyState title={t('admin.spuriousReports.emptyTitle')} description={t('admin.spuriousReports.emptyDescription')} />
  }

  return (
    <ul className="space-y-2">
      {reports.map((report) => (
        <li key={report.id}>
          <Link
            to={`/admin/spurious-reports/${report.id}`}
            className="flex items-center justify-between gap-3 rounded-[6px] border border-steel/20 p-4 hover:bg-surface-muted"
          >
            <div>
              <p className="font-mono text-sm text-ink">{report.listingId}</p>
              <p className="line-clamp-1 text-xs text-steel">{report.reasonNotes}</p>
            </div>
            <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_STYLES[report.status])}>
              {t(`admin.spuriousReports.status.${report.status}`, { defaultValue: report.status })}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
