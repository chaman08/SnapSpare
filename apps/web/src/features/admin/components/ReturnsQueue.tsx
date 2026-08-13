import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/components/states/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import { useOpenReturns, useReturnsConfig } from '@/features/admin/api/returnsQueueActions'
import { SlaCountdown } from '@/features/admin/components/SlaCountdown'
import { cn } from '@/lib/utils'

const STATUS_STYLES: Record<string, string> = {
  requested: 'bg-signal/10 text-signal',
  approved: 'bg-ink/10 text-ink',
  qc_disputed: 'bg-alert/10 text-alert',
}

const DAY_MS = 24 * 60 * 60_000

/** Returns & disputes module's dedicated Returns queue (design brief item 7) — a return awaiting a seller decision (`requested`), awaiting QC inspection after reverse pickup (`approved`, with an auto-pass SLA timer), or already escalated (`qc_disputed`, no separate timer — its dispute already has one, see DisputesQueue). */
export function ReturnsQueue() {
  const { t } = useTranslation()
  const { returns, loading } = useOpenReturns()
  const returnsConfig = useReturnsConfig()
  const qcAutoPassDays = returnsConfig?.qcAutoPassDays ?? 5

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    )
  }

  if (returns.length === 0) {
    return <EmptyState title={t('admin.returns.emptyTitle')} description={t('admin.returns.emptyDescription')} />
  }

  return (
    <ul className="space-y-2">
      {returns.map((ret) => {
        const qcDeadline = ret.status === 'approved' && ret.pickup ? ret.pickup.scheduledAt + qcAutoPassDays * DAY_MS : undefined
        return (
          <li key={ret.id} className="flex items-center justify-between gap-3 rounded-[6px] border border-steel/20 p-4">
            <div>
              <p className="font-mono text-sm text-ink">{ret.subOrderId}</p>
              <p className="text-xs text-steel">{t(`admin.returns.reason.${ret.reason}`, { defaultValue: ret.reason })}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_STYLES[ret.status])}>
                {t(`admin.returns.status.${ret.status}`, { defaultValue: ret.status })}
              </span>
              {qcDeadline !== undefined && <SlaCountdown deadlineMs={qcDeadline} />}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
