import type { RfqQuoteStatus, RfqStatus } from '@snapspare/shared'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

const RFQ_STATUS_STYLES: Record<RfqStatus, string> = {
  open: 'bg-signal/10 text-signal',
  quoted: 'bg-ink/10 text-ink',
  accepted: 'bg-verify/10 text-verify',
  converted: 'bg-verify/10 text-verify',
  expired: 'bg-steel/10 text-steel',
  withdrawn: 'bg-steel/10 text-steel',
}

const QUOTE_STATUS_STYLES: Record<RfqQuoteStatus, string> = {
  pending: 'bg-signal/10 text-signal',
  accepted: 'bg-verify/10 text-verify',
  rejected: 'bg-steel/10 text-steel',
  withdrawn: 'bg-steel/10 text-steel',
  expired: 'bg-steel/10 text-steel',
}

export function RfqStatusPill({ status }: { status: RfqStatus }) {
  const { t } = useTranslation()
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', RFQ_STATUS_STYLES[status])}>
      {t(`rfq.status.${status}`)}
    </span>
  )
}

export function RfqQuoteStatusPill({ status }: { status: RfqQuoteStatus }) {
  const { t } = useTranslation()
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', QUOTE_STATUS_STYLES[status])}>
      {t(`rfq.quoteStatus.${status}`)}
    </span>
  )
}
