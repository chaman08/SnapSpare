import { useTranslation } from 'react-i18next'
import { DeadLetterQueue } from '@/features/admin/components/DeadLetterQueue'

export default function AdminNotificationsPage() {
  const { t } = useTranslation()
  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-ink">{t('admin.notifications.title')}</h1>
        <p className="text-sm text-steel">{t('admin.notifications.subtitle')}</p>
      </div>
      <DeadLetterQueue />
    </div>
  )
}
