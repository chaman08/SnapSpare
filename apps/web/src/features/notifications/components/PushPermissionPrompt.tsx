import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { requestPushPermission } from '@/lib/pushNotifications'
import { registerFcmToken } from '../api/notificationActions'

const ASKED_STORAGE_KEY = 'snapspare:push-permission-asked'

/**
 * The only place requestPushPermission() is ever called from — mounted on
 * OrderDetailPage gated by `justPlaced` (the `?placed=1` query param
 * CheckoutPage navigates to on success), never on cold page load per the
 * design brief. Renders nothing once asked (granted, denied, or
 * unsupported) — the localStorage flag makes that permanent for this
 * browser, matching how a real permission prompt itself can only be shown
 * by the browser once.
 */
export function PushPermissionPrompt() {
  const { t } = useTranslation()
  const [asked, setAsked] = useState(() => {
    if (typeof window === 'undefined') return true
    if (typeof Notification === 'undefined') return true
    return Notification.permission !== 'default' || localStorage.getItem(ASKED_STORAGE_KEY) === '1'
  })
  const [requesting, setRequesting] = useState(false)

  if (asked) return null

  async function handleEnable() {
    setRequesting(true)
    try {
      await requestPushPermission((token) => registerFcmToken(token))
    } finally {
      localStorage.setItem(ASKED_STORAGE_KEY, '1')
      setAsked(true)
      setRequesting(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[6px] border border-steel/20 bg-surface-muted p-4">
      <p className="text-sm text-ink">{t('notifications.push.enablePrompt')}</p>
      <Button type="button" variant="outline" size="sm" onClick={() => void handleEnable()} disabled={requesting}>
        {t('notifications.push.enableButton')}
      </Button>
    </div>
  )
}
