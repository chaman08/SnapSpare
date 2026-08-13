import type { RfqQuote } from '@snapspare/shared'
import { formatINR } from '@snapspare/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ErrorState } from '@/components/states/ErrorState'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AcceptRfqQuoteDialog } from '@/features/rfq/components/AcceptRfqQuoteDialog'
import { RfqMessageThread } from '@/features/rfq/components/RfqMessageThread'
import { RfqQuoteComparisonTable } from '@/features/rfq/components/RfqQuoteComparisonTable'
import { RfqStatusPill } from '@/features/rfq/components/RfqStatusPill'
import { mapRfqErrorToI18nKey, withdrawRfq } from '@/features/rfq/api/rfqActions'
import { useRfq } from '@/features/rfq/api/useRfq'
import { useRfqQuotes } from '@/features/rfq/api/useRfqQuotes'

/** Buyer RFQ detail: status, quote comparison (requirement 4), and a per-quote message thread (requirement 5). */
export default function RfqDetailPage() {
  const { t } = useTranslation()
  const { rfqId } = useParams<{ rfqId: string }>()
  const { rfq, loading } = useRfq(rfqId)
  const { quotes } = useRfqQuotes(rfqId)
  const [acceptingQuote, setAcceptingQuote] = useState<RfqQuote | null>(null)
  const [threadQuote, setThreadQuote] = useState<RfqQuote | null>(null)
  const [withdrawing, setWithdrawing] = useState(false)

  async function handleWithdraw() {
    if (!rfq) return
    setWithdrawing(true)
    try {
      await withdrawRfq(rfq.id)
      toast.success(t('rfq.detail.withdrawSuccess'))
    } catch (error) {
      toast.error(t(mapRfqErrorToI18nKey(error)))
    } finally {
      setWithdrawing(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-3 px-4 py-6">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  if (!rfq) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6">
        <ErrorState message={t('rfq.detail.notFound')} onRetry={() => window.location.reload()} />
      </div>
    )
  }

  const canWithdraw = rfq.status === 'open' || rfq.status === 'quoted'

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-6">
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
        <div className="flex items-center gap-2">
          <RfqStatusPill status={rfq.status} />
          {canWithdraw ? (
            <Button type="button" variant="outline" size="sm" onClick={handleWithdraw} disabled={withdrawing}>
              {withdrawing ? t('common.loading') : t('rfq.detail.withdraw')}
            </Button>
          ) : null}
        </div>
      </div>

      {rfq.notes ? <p className="text-sm text-steel">{rfq.notes}</p> : null}

      <div>
        <h2 className="mb-2 font-heading text-lg font-semibold text-ink">{t('rfq.detail.quotesTitle')}</h2>
        <RfqQuoteComparisonTable rfq={rfq} quotes={quotes} onAccept={setAcceptingQuote} onOpenThread={setThreadQuote} />
      </div>

      {threadQuote ? (
        <div className="rounded-[6px] border border-steel/20 p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-heading text-lg font-semibold text-ink">
              {t('rfq.thread.titleWithSeller', { seller: threadQuote.sellerName })}
            </h2>
            <Button type="button" variant="ghost" size="sm" onClick={() => setThreadQuote(null)}>
              {t('common.close')}
            </Button>
          </div>
          <RfqMessageThread quote={threadQuote} />
        </div>
      ) : null}

      <AcceptRfqQuoteDialog rfq={rfq} quote={acceptingQuote} onClose={() => setAcceptingQuote(null)} />
    </div>
  )
}
