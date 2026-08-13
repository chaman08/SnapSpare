import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { EmptyState } from '@/components/states/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import { useSupportTicketDetail } from '@/features/admin/api/supportTicketActions'
import { SupportTicketPanel } from '@/features/admin/components/SupportTicketPanel'

export default function AdminSupportTicketDetailPage() {
  const { t } = useTranslation()
  const { ticketId } = useParams<{ ticketId: string }>()
  const { ticket, loading } = useSupportTicketDetail(ticketId)

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-6">
      <h1 className="font-heading text-2xl font-semibold text-ink">{t('admin.support.detailTitle')}</h1>
      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : ticket ? (
        <SupportTicketPanel ticket={ticket} />
      ) : (
        <EmptyState title={t('admin.support.notFound')} />
      )}
    </div>
  )
}
