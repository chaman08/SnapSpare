import { useTranslation } from 'react-i18next'
import { WarrantyClaimsQueue } from '@/features/admin/components/WarrantyClaimsQueue'

export default function AdminWarrantyClaimsQueuePage() {
  const { t } = useTranslation()
  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-6">
      <h1 className="font-heading text-2xl font-semibold text-ink">{t('admin.warrantyClaims.title')}</h1>
      <WarrantyClaimsQueue />
    </div>
  )
}
