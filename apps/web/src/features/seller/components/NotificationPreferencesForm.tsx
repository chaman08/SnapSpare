import type { NotificationChannel, SellerSettings } from '@snapspare/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { updateNotificationPreferences } from '@/features/seller/api/sellerSettingsActions'

const CHANNELS: NotificationChannel[] = ['push', 'whatsapp', 'sms', 'email']

interface NotificationPreferencesFormProps {
  sellerId: string
  initial: SellerSettings['notificationPreferences'] | undefined
}

export function NotificationPreferencesForm({ sellerId, initial }: NotificationPreferencesFormProps) {
  const { t } = useTranslation()
  const [channels, setChannels] = useState<NotificationChannel[]>(initial?.channels ?? ['push', 'whatsapp'])
  const [saving, setSaving] = useState(false)

  function toggle(channel: NotificationChannel) {
    setChannels((current) => (current.includes(channel) ? current.filter((c) => c !== channel) : [...current, channel]))
  }

  async function handleSave() {
    setSaving(true)
    try {
      await updateNotificationPreferences(sellerId, channels)
      toast.success(t('sellerSettings.saved'))
    } catch {
      toast.error(t('common.somethingWentWrong'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="space-y-3 rounded-[6px] border border-steel/20 p-4">
      <h2 className="font-heading text-lg font-semibold text-ink">{t('sellerSettings.notifications.title')}</h2>
      <div className="grid grid-cols-2 gap-1.5">
        {CHANNELS.map((channel) => (
          <label key={channel} className="flex min-h-tap items-center gap-2 text-sm text-ink">
            <input type="checkbox" className="h-4 w-4 accent-signal" checked={channels.includes(channel)} onChange={() => toggle(channel)} />
            {t(`sellerSettings.notifications.channel.${channel}`)}
          </label>
        ))}
      </div>
      <Button type="button" variant="cta" onClick={handleSave} disabled={saving}>
        {saving ? t('common.loading') : t('sellerSettings.save')}
      </Button>
    </section>
  )
}
