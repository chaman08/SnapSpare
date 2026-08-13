import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { EmptyState } from '@/components/states/EmptyState'
import { ErrorState } from '@/components/states/ErrorState'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/features/auth/api/AuthProvider'
import { RfqList } from '@/features/rfq/components/RfqList'
import { useMyRfqs } from '@/features/rfq/api/useMyRfqs'

/** Buyer's own RFQs (requirement 1's standalone flow list) — loading skeleton, empty state with a next action, error state with retry. */
export default function RfqListPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { rfqs, loading, error } = useMyRfqs(user?.uid)

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-semibold text-ink">{t('rfq.list.title')}</h1>
        <Button type="button" variant="cta" onClick={() => navigate('/rfq/new')}>
          {t('rfq.list.newRequest')}
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : error ? (
        <ErrorState onRetry={() => window.location.reload()} />
      ) : rfqs.length === 0 ? (
        <EmptyState
          title={t('rfq.list.emptyTitle')}
          description={t('rfq.list.emptyDescription')}
          actionLabel={t('rfq.list.newRequest')}
          onAction={() => navigate('/rfq/new')}
        />
      ) : (
        <RfqList rfqs={rfqs} basePath="/rfq" />
      )}
    </div>
  )
}
