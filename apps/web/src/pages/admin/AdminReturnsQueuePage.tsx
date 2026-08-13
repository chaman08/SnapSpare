import { useTranslation } from 'react-i18next'
import { ReturnsQueue } from '@/features/admin/components/ReturnsQueue'

export default function AdminReturnsQueuePage() {
  const { t } = useTranslation()

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-6">
      <h1 className="font-heading text-2xl font-semibold text-ink">{t('admin.nav.returns')}</h1>
      <ReturnsQueue />
    </div>
  )
}
