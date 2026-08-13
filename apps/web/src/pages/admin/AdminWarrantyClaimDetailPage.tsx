import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { EmptyState } from '@/components/states/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import { useWarrantyClaimDetail } from '@/features/admin/api/warrantyClaimActions'
import { WarrantyClaimPanel } from '@/features/admin/components/WarrantyClaimPanel'

export default function AdminWarrantyClaimDetailPage() {
  const { t } = useTranslation()
  const { claimId } = useParams<{ claimId: string }>()
  const { claim, loading } = useWarrantyClaimDetail(claimId)

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-6">
      <h1 className="font-heading text-2xl font-semibold text-ink">{t('admin.warrantyClaims.detailTitle')}</h1>
      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : claim ? (
        <WarrantyClaimPanel claim={claim} />
      ) : (
        <EmptyState title={t('admin.warrantyClaims.notFound')} />
      )}
    </div>
  )
}
