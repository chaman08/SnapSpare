import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { EmptyState } from '@/components/states/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import { usePartRequestDetail } from '@/features/admin/api/partRequestActions'
import { PartRequestReviewPanel } from '@/features/admin/components/PartRequestReviewPanel'

export default function AdminPartRequestDetailPage() {
  const { t } = useTranslation()
  const { requestId } = useParams<{ requestId: string }>()
  const { request, loading } = usePartRequestDetail(requestId)

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-6">
      <h1 className="font-heading text-2xl font-semibold text-ink">{t('admin.partRequests.detailTitle')}</h1>
      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : request ? (
        <PartRequestReviewPanel request={request} />
      ) : (
        <EmptyState title={t('admin.partRequests.notFound')} />
      )}
    </div>
  )
}
