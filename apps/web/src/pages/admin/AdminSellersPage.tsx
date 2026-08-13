import { useTranslation } from 'react-i18next'
import { SellersTable } from '@/features/admin/components/SellersTable'

export default function AdminSellersPage() {
  const { t } = useTranslation()

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-6">
      <h1 className="font-heading text-2xl font-semibold text-ink">{t('admin.nav.sellers')}</h1>
      <SellersTable />
    </div>
  )
}
