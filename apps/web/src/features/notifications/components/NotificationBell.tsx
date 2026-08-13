import { Bell } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/features/auth/api/AuthProvider'
import { cn } from '@/lib/utils'
import { useNotifications } from '../api/useNotifications'
import { NotificationPanel } from './NotificationPanel'

interface NotificationBellProps {
  /** Icon/hover colors — override for shells with a dark header (e.g. SellerShell/AdminShell's bg-ink bar). Defaults to the light AppShell header's palette. */
  className?: string
}

/** Header slot: bell icon + unread badge, opens NotificationPanel. Renders nothing signed out — there's nothing to show. */
export function NotificationBell({ className }: NotificationBellProps) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const { notifications, unreadCount, loading, error } = useNotifications(user?.uid)

  if (!user) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('notifications.bellLabel')}
        className={cn(
          'relative flex min-h-tap min-w-tap items-center justify-center rounded-[6px] text-ink hover:bg-surface-muted',
          className,
        )}
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {unreadCount > 0 ? (
          <span
            className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-signal px-1 text-[10px] font-semibold leading-none text-ink"
            aria-live="polite"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        ) : null}
      </button>
      <NotificationPanel
        open={open}
        onClose={() => setOpen(false)}
        notifications={notifications}
        loading={loading}
        error={error}
      />
    </>
  )
}
