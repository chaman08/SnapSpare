import { useTranslation } from 'react-i18next'
import { PartRequestsQueue } from '@/features/admin/components/PartRequestsQueue'

export default function AdminPartRequestsQueuePage() {
  const { t } = useTranslation()
  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-6">
      <h1 className="font-heading text-2xl font-semibold text-ink">{t('admin.partRequests.title')}</h1>
      <PartRequestsQueue />
    </div>
  )
}
