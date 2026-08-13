import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { EmptyState } from '@/components/states/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import { useOpenSupportTickets } from '@/features/admin/api/supportTicketActions'
import { cn } from '@/lib/utils'

export function SupportTicketsQueue() {
  const { t } = useTranslation()
  const { tickets, loading } = useOpenSupportTickets()

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    )
  }

  if (tickets.length === 0) {
    return <EmptyState title={t('admin.support.emptyTitle')} description={t('admin.support.emptyDescription')} />
  }

  return (
    <ul className="space-y-2">
      {tickets.map((ticket) => {
        const hoursLeft = Math.max(0, Math.round((ticket.slaBreachAt - Date.now()) / (60 * 60_000)))
        return (
          <li key={ticket.id}>
            <Link
              to={`/admin/support/${ticket.id}`}
              className="flex items-center justify-between gap-3 rounded-[6px] border border-steel/20 p-4 hover:bg-surface-muted"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{ticket.subject}</p>
                <p className="text-xs text-steel">
                  {ticket.contactName} · {t(`support.category.${ticket.category}`)} · {t(`admin.support.status.${ticket.status}`)}
                </p>
              </div>
              <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-xs font-medium', hoursLeft <= 6 ? 'bg-alert/10 text-alert' : 'bg-ink/10 text-ink')}>
                {hoursLeft}h
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
