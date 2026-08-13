import type { Rfq, RfqQuote } from '@snapspare/shared'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { RfqStatusPill } from '@/features/rfq/components/RfqStatusPill'

interface SellerRfqInboxListProps {
  rfqs: Rfq[]
  ownQuotesByRfqId: Map<string, RfqQuote>
}

export function SellerRfqInboxList({ rfqs, ownQuotesByRfqId }: SellerRfqInboxListProps) {
  const { t } = useTranslation()
  return (
    <ul className="space-y-2">
      {rfqs.map((rfq) => {
        const ownQuote = ownQuotesByRfqId.get(rfq.id)
        return (
          <li key={rfq.id}>
            <Link
              to={`/seller/rfqs/${rfq.id}`}
              className="flex items-center justify-between gap-3 rounded-[6px] border border-steel/20 p-4 hover:bg-surface-muted"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-ink">{rfq.freeTextDescription ?? rfq.partId ?? t('rfq.list.untitled')}</p>
                <p className="text-xs text-steel">
                  {t('rfq.list.qty', { count: rfq.qtyRequested })}
                  {rfq.responseDeadline !== undefined ? ` · ${t('rfq.seller.respondBy', { date: new Date(rfq.responseDeadline).toLocaleDateString() })}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {ownQuote ? (
                  <span className="rounded-full bg-verify/10 px-2 py-0.5 text-xs font-medium text-verify">
                    {t('rfq.seller.youQuoted')}
                  </span>
                ) : null}
                <RfqStatusPill status={rfq.status} />
              </div>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
