import type { NotificationChannel } from '@snapspare/shared'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/api/AuthProvider'
import { updateNotificationPreferences } from '../api/notificationActions'
import { useNotificationPreferences } from '../api/useNotificationPreferences'

const CHANNELS: NotificationChannel[] = ['push', 'whatsapp', 'sms', 'email']

/**
 * Buyer-facing (and reusable for any signed-in role) notification
 * preferences — writes to the canonical notificationPreferences/{uid}
 * collection Phase 16's dispatcher reads (see
 * functions/src/notifications/preferences.ts). Separate from the older
 * seller-only NotificationPreferencesForm under features/seller, which
 * still owns its own embedded sellerSettings field but is no longer read
 * by the dispatcher.
 */
export function NotificationPreferencesForm() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { channels: savedChannels, marketingOptOut: savedOptOut, loading } = useNotificationPreferences(user?.uid)

  const [channels, setChannels] = useState(savedChannels)
  const [marketingOptOut, setMarketingOptOut] = useState(savedOptOut)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setChannels(savedChannels)
    setMarketingOptOut(savedOptOut)
  }, [savedChannels, savedOptOut])

  function toggle(channel: NotificationChannel) {
    setChannels((current) => ({ ...current, [channel]: !current[channel] }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      await updateNotificationPreferences({ channels, marketingOptOut })
      toast.success(t('notifications.preferences.saved'))
    } catch {
      toast.error(t('common.somethingWentWrong'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return null

  return (
    <section className="space-y-3 rounded-[6px] border border-steel/20 p-4">
      <h2 className="font-heading text-lg font-semibold text-ink">{t('notifications.preferences.title')}</h2>
      <p className="text-sm text-steel">{t('notifications.preferences.transactionalNote')}</p>

      <div>
        <p className="mb-1.5 text-sm font-medium text-ink">{t('notifications.preferences.channelsHeading')}</p>
        <div className="grid grid-cols-2 gap-1.5">
          {CHANNELS.map((channel) => (
            <label key={channel} className="flex min-h-tap items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                className="h-4 w-4 accent-signal"
                checked={channels[channel]}
                onChange={() => toggle(channel)}
              />
              {t(`notifications.preferences.channel.${channel}`)}
            </label>
          ))}
        </div>
      </div>

      <label className="flex min-h-tap items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          className="h-4 w-4 accent-signal"
          checked={marketingOptOut}
          onChange={() => setMarketingOptOut((v) => !v)}
        />
        {t('notifications.preferences.marketingOptOut')}
      </label>

      <Button type="button" variant="cta" onClick={() => void handleSave()} disabled={saving}>
        {saving ? t('common.loading') : t('notifications.preferences.save')}
      </Button>
    </section>
  )
}
