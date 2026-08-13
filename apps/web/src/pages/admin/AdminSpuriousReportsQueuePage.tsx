import { useTranslation } from 'react-i18next'
import { SpuriousReportsQueue } from '@/features/admin/components/SpuriousReportsQueue'

export default function AdminSpuriousReportsQueuePage() {
  const { t } = useTranslation()
  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-6">
      <h1 className="font-heading text-2xl font-semibold text-ink">{t('admin.spuriousReports.title')}</h1>
      <SpuriousReportsQueue />
    </div>
  )
}
