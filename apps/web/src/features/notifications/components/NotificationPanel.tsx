import type { Notification } from '@snapspare/shared'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { EmptyState } from '@/components/states/EmptyState'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { markAllNotificationsRead, markNotificationRead } from '../api/notificationActions'

interface NotificationPanelProps {
  open: boolean
  onClose: () => void
  notifications: Notification[]
  loading: boolean
  error: Error | null
}

function relativeTime(epochMs: number, locale: string): string {
  const diffMs = epochMs - Date.now()
  const diffMinutes = Math.round(diffMs / 60_000)
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  if (Math.abs(diffMinutes) < 60) return rtf.format(diffMinutes, 'minute')
  const diffHours = Math.round(diffMinutes / 60)
  if (Math.abs(diffHours) < 24) return rtf.format(diffHours, 'hour')
  return rtf.format(Math.round(diffHours / 24), 'day')
}

function linkFor(notification: Notification): string | undefined {
  if (notification.orderId) return `/orders/${notification.orderId}`
  if (notification.rfqId) return `/rfq/${notification.rfqId}`
  return undefined
}

/** Sheet-style panel — same hand-rolled overlay pattern as VehicleQuickSwitchSheet, not a shadcn Sheet, to match the rest of components/layout. */
export function NotificationPanel({ open, onClose, notifications, loading, error }: NotificationPanelProps) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  async function handleItemClick(notification: Notification) {
    if (!notification.read) {
      void markNotificationRead(notification.id).catch(() => undefined)
    }
    onClose()
    const link = linkFor(notification)
    if (link) navigate(link)
  }

  async function handleMarkAllRead() {
    await markAllNotificationsRead().catch(() => undefined)
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-ink/40" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('notifications.title')}
        className="fixed inset-x-0 bottom-0 z-50 flex max-h-[80vh] flex-col overflow-hidden rounded-t-[6px] border-t border-steel/20 bg-surface md:inset-x-auto md:bottom-auto md:right-4 md:top-16 md:w-96 md:rounded-[6px] md:border"
      >
        <div className="flex items-center justify-between border-b border-steel/10 px-4 py-3">
          <p className="font-heading text-lg font-semibold text-ink">{t('notifications.title')}</p>
          {notifications.some((n) => !n.read) ? (
            <Button type="button" variant="ghost" size="sm" onClick={handleMarkAllRead}>
              {t('notifications.markAllRead')}
            </Button>
          ) : null}
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="space-y-2 p-4">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : error ? (
            <EmptyState
              title={t('notifications.errorTitle')}
              actionLabel={t('common.retry')}
              onAction={() => window.location.reload()}
            />
          ) : notifications.length === 0 ? (
            <EmptyState
              title={t('notifications.empty')}
              actionLabel={t('notifications.emptyAction')}
              onAction={() => {
                onClose()
                navigate('/categories')
              }}
            />
          ) : (
            <ul>
              {notifications.map((notification) => (
                <li key={notification.id} className="border-b border-steel/10 last:border-b-0">
                  <button
                    type="button"
                    onClick={() => void handleItemClick(notification)}
                    className="flex w-full items-start gap-2 px-4 py-3 text-left hover:bg-surface-muted"
                  >
                    {!notification.read ? (
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-signal" aria-hidden="true" />
                    ) : (
                      <span className="mt-1.5 h-2 w-2 shrink-0" aria-hidden="true" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-ink">{notification.title}</span>
                      <span className="block truncate text-sm text-steel">{notification.body}</span>
                      <span className="mt-0.5 block text-xs text-steel">
                        {relativeTime(notification.createdAt, i18n.language)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  )
}
