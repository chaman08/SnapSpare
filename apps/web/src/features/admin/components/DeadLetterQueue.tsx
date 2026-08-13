import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/components/states/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import { useUnresolvedDeadLetters } from '@/features/admin/api/notificationDeadLetterActions'

/** Read-only triage view — the retry sweep already owns retries, this collection is just a record of what gave up (see functions/src/notifications/processNotificationChannels.ts). */
export function DeadLetterQueue() {
  const { t } = useTranslation()
  const { deadLetters, loading } = useUnresolvedDeadLetters()

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    )
  }

  if (deadLetters.length === 0) {
    return <EmptyState title={t('admin.notifications.emptyTitle')} />
  }

  return (
    <div className="overflow-x-auto rounded-[6px] border border-steel/20">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="bg-surface-muted text-xs uppercase text-steel">
          <tr>
            <th className="px-4 py-2">{t('admin.notifications.type')}</th>
            <th className="px-4 py-2">{t('admin.notifications.channel')}</th>
            <th className="px-4 py-2">{t('admin.notifications.attempts')}</th>
            <th className="px-4 py-2">{t('admin.notifications.lastError')}</th>
            <th className="px-4 py-2">{t('admin.notifications.failedAt')}</th>
          </tr>
        </thead>
        <tbody>
          {deadLetters.map((row) => (
            <tr key={row.id} className="border-t border-steel/10">
              <td className="px-4 py-2 font-mono text-xs">{row.type}</td>
              <td className="px-4 py-2 capitalize">{row.channel}</td>
              <td className="px-4 py-2">{row.attempts}</td>
              <td className="max-w-xs truncate px-4 py-2 text-steel" title={row.lastError}>
                {row.lastError}
              </td>
              <td className="px-4 py-2 text-steel">{new Date(row.failedAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
