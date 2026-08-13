import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { EmptyState } from '@/components/states/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import { useSellerApplicationDetail } from '@/features/admin/api/sellerApplicationActions'
import { SellerApplicationReviewPanel } from '@/features/admin/components/SellerApplicationReviewPanel'

export default function AdminSellerApplicationDetailPage() {
  const { t } = useTranslation()
  const { applicationId } = useParams<{ applicationId: string }>()
  const { application, loading } = useSellerApplicationDetail(applicationId)

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-6">
      <h1 className="font-heading text-2xl font-semibold text-ink">{t('admin.sellerApplications.detailTitle')}</h1>
      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : application ? (
        <SellerApplicationReviewPanel application={application} />
      ) : (
        <EmptyState title={t('admin.sellerApplications.notFound')} />
      )}
    </div>
  )
}
