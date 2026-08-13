import { useTranslation } from 'react-i18next'
import { useAuth } from '@/features/auth/api/AuthProvider'
import { EwayBillTasksPanel } from '@/features/seller/components/EwayBillTasksPanel'

/** Seller-console home for GST compliance to-dos (design brief item 6) — invoices/credit notes are downloaded inline from the Orders queue instead of listed again here. */
export default function SellerTaxPage() {
  const { t } = useTranslation()
  const { claims } = useAuth()

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-6">
      <h1 className="font-heading text-2xl font-semibold text-ink">{t('sellerOrders.nav.tax')}</h1>
      <EwayBillTasksPanel sellerId={claims?.sellerId} />
    </div>
  )
}
