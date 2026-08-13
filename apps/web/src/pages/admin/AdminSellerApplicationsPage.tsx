import { useTranslation } from 'react-i18next'
import { SellerApplicationsQueue } from '@/features/admin/components/SellerApplicationsQueue'

export default function AdminSellerApplicationsPage() {
  const { t } = useTranslation()

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-6">
      <h1 className="font-heading text-2xl font-semibold text-ink">{t('admin.nav.sellerApplications')}</h1>
      <SellerApplicationsQueue />
    </div>
  )
}
