import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/components/states/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/features/auth/api/AuthProvider'
import { SellerRfqInboxList } from '@/features/rfq/components/SellerRfqInboxList'
import { useSellerQuotes, useSellerRfqInbox } from '@/features/rfq/api/useSellerRfqs'

/** Requirement 2/3: the seller's RFQ inbox — RFQs routed to them by matchSellersForRfq. */
export default function SellerRfqsPage() {
  const { t } = useTranslation()
  const { claims } = useAuth()
  const { rfqs, loading } = useSellerRfqInbox(claims?.sellerId)
  const { quotes } = useSellerQuotes(claims?.sellerId)

  const ownQuotesByRfqId = useMemo(() => {
    const map = new Map<string, (typeof quotes)[number]>()
    for (const quote of quotes) {
      if (quote.status === 'pending' && !map.has(quote.rfqId)) map.set(quote.rfqId, quote)
    }
    return map
  }, [quotes])

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-6">
      <h1 className="font-heading text-2xl font-semibold text-ink">{t('rfq.seller.inboxTitle')}</h1>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : rfqs.length === 0 ? (
        <EmptyState title={t('rfq.seller.inboxEmptyTitle')} description={t('rfq.seller.inboxEmptyDescription')} />
      ) : (
        <SellerRfqInboxList rfqs={rfqs} ownQuotesByRfqId={ownQuotesByRfqId} />
      )}
    </div>
  )
}
