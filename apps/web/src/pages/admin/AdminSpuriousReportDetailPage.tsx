import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { EmptyState } from '@/components/states/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import { useSpuriousReportDetail } from '@/features/admin/api/spuriousReportActions'
import { SpuriousReportPanel } from '@/features/admin/components/SpuriousReportPanel'

export default function AdminSpuriousReportDetailPage() {
  const { t } = useTranslation()
  const { reportId } = useParams<{ reportId: string }>()
  const { report, loading } = useSpuriousReportDetail(reportId)

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-6">
      <h1 className="font-heading text-2xl font-semibold text-ink">{t('admin.spuriousReports.detailTitle')}</h1>
      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : report ? (
        <SpuriousReportPanel report={report} />
      ) : (
        <EmptyState title={t('admin.spuriousReports.notFound')} />
      )}
    </div>
  )
}
