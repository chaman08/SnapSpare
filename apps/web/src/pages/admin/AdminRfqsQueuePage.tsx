import { useTranslation } from 'react-i18next'
import { AdminRfqsQueue } from '@/features/rfq/components/AdminRfqsQueue'

export default function AdminRfqsQueuePage() {
  const { t } = useTranslation()
  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-6">
      <h1 className="font-heading text-2xl font-semibold text-ink">{t('admin.rfqs.title')}</h1>
      <AdminRfqsQueue />
    </div>
  )
}
