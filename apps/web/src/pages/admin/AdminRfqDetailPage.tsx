import type { RfqQuote } from '@snapspare/shared'
import { formatINR } from '@snapspare/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { ErrorState } from '@/components/states/ErrorState'
import { Skeleton } from '@/components/ui/skeleton'
import { RfqMessageThread } from '@/features/rfq/components/RfqMessageThread'
import { RfqQuoteComparisonTable } from '@/features/rfq/components/RfqQuoteComparisonTable'
import { RfqStatusPill } from '@/features/rfq/components/RfqStatusPill'
import { useRfq } from '@/features/rfq/api/useRfq'
import { useRfqQuotes } from '@/features/rfq/api/useRfqQuotes'

/** Requirement 7: admin read-only view of one RFQ — full quote comparison and, on request, any quote's message thread. */
export default function AdminRfqDetailPage() {
  const { t } = useTranslation()
  const { rfqId } = useParams<{ rfqId: string }>()
  const { rfq, loading } = useRfq(rfqId)
  const { quotes } = useRfqQuotes(rfqId)
  const [threadQuote, setThreadQuote] = useState<RfqQuote | null>(null)

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
        <RfqStatusPill status={rfq.status} />
      </div>

      <RfqQuoteComparisonTable
        rfq={rfq}
        quotes={quotes}
        readOnly
        onAccept={() => undefined}
        onOpenThread={setThreadQuote}
      />

      {threadQuote ? (
        <div className="rounded-[6px] border border-steel/20 p-4">
          <h2 className="mb-2 font-heading text-lg font-semibold text-ink">
            {t('rfq.thread.titleWithSeller', { seller: threadQuote.sellerName })}
          </h2>
          <RfqMessageThread quote={threadQuote} readOnly />
        </div>
      ) : null}
    </div>
  )
}
