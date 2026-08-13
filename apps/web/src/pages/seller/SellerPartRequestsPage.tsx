import type { PartRequestStatus } from '@snapspare/shared'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { EmptyState } from '@/components/states/EmptyState'
import { ErrorState } from '@/components/states/ErrorState'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/features/auth/api/AuthProvider'
import { useSellerPartRequests } from '@/features/seller-listings/api/partRequests'

const STATUS_BADGE: Record<PartRequestStatus, string> = {
  pending: 'bg-steel/10 text-steel',
  under_review: 'bg-ink/10 text-ink',
  changes_requested: 'bg-alert/10 text-alert',
  approved: 'bg-verify/10 text-verify',
  rejected: 'bg-alert/10 text-alert',
}

/** Requirement 2's "show queue status" — a seller's own submitted new-part requests. */
export default function SellerPartRequestsPage() {
  const { t } = useTranslation()
  const { claims } = useAuth()
  const sellerId = claims?.sellerId
  const { data: requests, isLoading, isError, refetch } = useSellerPartRequests(sellerId)

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-heading text-2xl font-semibold text-ink">{t('sellerListings.partRequest.queueTitle')}</h1>
        <Button asChild variant="cta" size="sm">
          <Link to="/seller/part-requests/new">{t('sellerListings.partRequest.newAction')}</Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : !requests || requests.length === 0 ? (
        <EmptyState
          title={t('sellerListings.partRequest.emptyTitle')}
          description={t('sellerListings.partRequest.emptyDescription')}
        />
      ) : (
        <ul className="space-y-2">
          {requests.map((request) => (
            <li key={request.id} className="rounded-[6px] border border-steel/20 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-ink">{request.title}</p>
                  {request.brand ? <p className="text-xs text-steel">{request.brand}</p> : null}
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[request.status]}`}>
                  {t(`sellerListings.partRequest.status.${request.status}`)}
                </span>
              </div>
              {request.reviewNotes.length > 0 ? (
                <p className="mt-2 text-sm text-steel">{request.reviewNotes[request.reviewNotes.length - 1]?.message}</p>
              ) : null}
              {request.status === 'approved' && request.linkedListingId ? (
                <Link
                  to={`/seller/listings/${request.linkedListingId}/edit`}
                  className="mt-2 inline-block text-sm font-medium text-signal hover:underline"
                >
                  {t('sellerListings.partRequest.viewListing')}
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
