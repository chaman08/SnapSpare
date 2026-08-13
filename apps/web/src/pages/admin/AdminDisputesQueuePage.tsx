import { useTranslation } from 'react-i18next'
import { DisputesQueue } from '@/features/admin/components/DisputesQueue'

export default function AdminDisputesQueuePage() {
  const { t } = useTranslation()
  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-6">
      <h1 className="font-heading text-2xl font-semibold text-ink">{t('admin.disputes.title')}</h1>
      <DisputesQueue />
    </div>
  )
}
