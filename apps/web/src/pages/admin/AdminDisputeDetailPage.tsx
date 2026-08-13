import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { EmptyState } from '@/components/states/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import { useDisputeDetail } from '@/features/admin/api/disputeActions'
import { DisputePanel } from '@/features/admin/components/DisputePanel'

export default function AdminDisputeDetailPage() {
  const { t } = useTranslation()
  const { disputeId } = useParams<{ disputeId: string }>()
  const { dispute, loading } = useDisputeDetail(disputeId)

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-6">
      <h1 className="font-heading text-2xl font-semibold text-ink">{t('admin.disputes.detailTitle')}</h1>
      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : dispute ? (
        <DisputePanel dispute={dispute} />
      ) : (
        <EmptyState title={t('admin.disputes.notFound')} />
      )}
    </div>
  )
}
