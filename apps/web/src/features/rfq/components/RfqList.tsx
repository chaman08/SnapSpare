import type { Rfq } from '@snapspare/shared'
import { formatINR } from '@snapspare/shared'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { RfqStatusPill } from '@/features/rfq/components/RfqStatusPill'

export function RfqList({ rfqs, basePath }: { rfqs: Rfq[]; basePath: string }) {
  const { t } = useTranslation()
  return (
    <ul className="space-y-2">
      {rfqs.map((rfq) => (
        <li key={rfq.id}>
          <Link
            to={`${basePath}/${rfq.id}`}
            className="flex items-center justify-between gap-3 rounded-[6px] border border-steel/20 p-4 hover:bg-surface-muted"
          >
            <div className="min-w-0">
              <p className="truncate font-medium text-ink">{rfq.freeTextDescription ?? rfq.partId ?? t('rfq.list.untitled')}</p>
              <p className="text-xs text-steel">
                {t('rfq.list.qty', { count: rfq.qtyRequested })}
                {rfq.targetPricePaise !== undefined ? ` · ${t('rfq.list.target', { price: formatINR(rfq.targetPricePaise) })}` : ''}
                {rfq.quoteCount > 0 ? ` · ${t('rfq.list.quoteCount', { count: rfq.quoteCount })}` : ''}
              </p>
            </div>
            <RfqStatusPill status={rfq.status} />
          </Link>
        </li>
      ))}
    </ul>
  )
}
