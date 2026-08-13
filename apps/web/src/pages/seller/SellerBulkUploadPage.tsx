import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { EmptyState } from '@/components/states/EmptyState'
import { useAuth } from '@/features/auth/api/AuthProvider'
import { BulkUploadWizard } from '@/features/seller-listings/components/BulkUploadWizard'

/** Requirement 4: downloadable template → upload → server-side parse → preview-before-commit → commit. */
export default function SellerBulkUploadPage() {
  const { t } = useTranslation()
  const { claims } = useAuth()
  const sellerId = claims?.sellerId
  const navigate = useNavigate()

  if (!sellerId) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6">
        <EmptyState title={t('sellerListings.bulkUpload.notASeller')} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
      <h1 className="font-heading text-2xl font-semibold text-ink">{t('sellerListings.bulkUpload.pageTitle')}</h1>
      <BulkUploadWizard sellerId={sellerId} onCommitted={() => navigate('/seller/listings')} />
    </div>
  )
}
