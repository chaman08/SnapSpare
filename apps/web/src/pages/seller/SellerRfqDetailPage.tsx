import { formatINR } from '@snapspare/shared'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useState } from 'react'
import { ErrorState } from '@/components/states/ErrorState'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/features/auth/api/AuthProvider'
import { mapRfqErrorToI18nKey, withdrawRfqQuote } from '@/features/rfq/api/rfqActions'
import { useRfq } from '@/features/rfq/api/useRfq'
import { useRfqQuotes } from '@/features/rfq/api/useRfqQuotes'
import { RfqMessageThread } from '@/features/rfq/components/RfqMessageThread'
import { RfqQuoteStatusPill, RfqStatusPill } from '@/features/rfq/components/RfqStatusPill'
import { SellerQuoteBuilderForm } from '@/features/rfq/components/SellerQuoteBuilderForm'

/** Requirement 3: the seller's quote builder for one routed RFQ, plus their own quote status and the message thread once they've quoted. */
export default function SellerRfqDetailPage() {
  const { t } = useTranslation()
  const { rfqId } = useParams<{ rfqId: string }>()
  const { claims } = useAuth()
  const { rfq, loading } = useRfq(rfqId)
  const { quotes } = useRfqQuotes(rfqId)
  const [withdrawing, setWithdrawing] = useState(false)

  const ownQuote = quotes.find((q) => q.sellerId === claims?.sellerId && q.status === 'pending')

  async function handleWithdraw() {
    if (!ownQuote) return
    setWithdrawing(true)
    try {
      await withdrawRfqQuote(ownQuote.id)
      toast.success(t('rfq.seller.quoteWithdrawn'))
    } catch (error) {
      toast.error(t(mapRfqErrorToI18nKey(error)))
    } finally {
      setWithdrawing(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-3 px-4 py-6">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (!rfq || !claims?.sellerId) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6">
        <ErrorState message={t('rfq.detail.notFound')} onRetry={() => window.location.reload()} />
      </div>
    )
  }

  const canQuote = rfq.status === 'open' || rfq.status === 'quoted'

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-ink">
            {rfq.freeTextDescription ?? rfq.partId ?? t('rfq.list.untitled')}
          </h1>
          <p className="text-sm text-steel">
            {t('rfq.list.qty', { count: rfq.qtyRequested })}
            {rfq.targetPricePaise !== undefined ? ` · ${t('rfq.list.target', { price: formatINR(rfq.targetPricePaise) })}` : ''}
            {' · '}
            {t('rfq.detail.deliveryTo', { pincode: rfq.deliveryPincode })}
          </p>
        </div>
        <RfqStatusPill status={rfq.status} />
      </div>

      {rfq.notes ? <p className="text-sm text-steel">{rfq.notes}</p> : null}

      {ownQuote ? (
        <div className="space-y-3 rounded-[6px] border border-steel/20 p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-lg font-semibold text-ink">{t('rfq.seller.yourQuote')}</h2>
            <RfqQuoteStatusPill status={ownQuote.status} />
          </div>
          <p className="text-sm text-ink">
            {t('rfq.accept.lineSummary', { qty: ownQuote.qtyOffered, price: formatINR(ownQuote.unitPricePaise) })}
          </p>
          {ownQuote.status === 'pending' ? (
            <Button type="button" variant="outline" size="sm" onClick={handleWithdraw} disabled={withdrawing}>
              {withdrawing ? t('common.loading') : t('rfq.seller.withdrawQuote')}
            </Button>
          ) : null}
          <RfqMessageThread quote={ownQuote} />
        </div>
      ) : canQuote ? (
        <div className="rounded-[6px] border border-steel/20 p-4">
          <h2 className="mb-3 font-heading text-lg font-semibold text-ink">{t('rfq.seller.buildQuote')}</h2>
          <SellerQuoteBuilderForm sellerId={claims.sellerId} rfq={rfq} onSubmitted={() => undefined} />
        </div>
      ) : (
        <p className="text-sm text-steel">{t('rfq.seller.rfqClosed')}</p>
      )}
    </div>
  )
}
