import type { LedgerEntry, Payout } from '@snapspare/shared'
import { formatINR } from '@snapspare/shared'
import { useTranslation } from 'react-i18next'
import { Skeleton } from '@/components/ui/skeleton'

const ENTRY_TYPE_LABEL_KEY: Record<LedgerEntry['type'], string> = {
  order_credit: 'sellerPayments.entryType.orderCredit',
  commission_debit: 'sellerPayments.entryType.commission',
  refund_debit: 'sellerPayments.entryType.refund',
  payout_debit: 'sellerPayments.entryType.payout',
  adjustment: 'sellerPayments.entryType.adjustment',
  tcs_debit: 'sellerPayments.entryType.tcs',
  tds_debit: 'sellerPayments.entryType.tds',
  shipping_charge: 'sellerPayments.entryType.shipping',
  penalty: 'sellerPayments.entryType.penalty',
  dispute_refund_debit: 'sellerPayments.entryType.disputeRefund',
}

interface LedgerBalanceCardProps {
  balancePaise: number | undefined
  entries: LedgerEntry[]
  upcomingPayout: Payout | undefined
  loading: boolean
}

/** Current balance + upcoming payout date + a recent-activity list (design brief item 6). Balance is always the ledger's `currentBalancePaise`, itself the running sum of every entry ever posted — never a mutable field computed here. */
export function LedgerBalanceCard({ balancePaise, entries, upcomingPayout, loading }: LedgerBalanceCardProps) {
  const { t } = useTranslation()

  if (loading) return <Skeleton className="h-40 w-full" />

  return (
    <div className="rounded-[6px] border border-steel/20 bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-steel/10 pb-4">
        <div>
          <p className="text-sm text-steel">{t('sellerPayments.currentBalance')}</p>
          <p className="font-heading text-3xl font-semibold text-ink">{formatINR(balancePaise ?? 0)}</p>
        </div>
        {upcomingPayout ? (
          <div className="text-right">
            <p className="text-sm text-steel">{t('sellerPayments.upcomingPayout')}</p>
            <p className="font-mono text-lg font-medium text-verify">{formatINR(upcomingPayout.netAmountPaise)}</p>
            <p className="text-xs text-steel">
              {t('sellerPayments.expectedOn', { date: new Date(upcomingPayout.periodTo).toLocaleDateString() })}
            </p>
          </div>
        ) : null}
      </div>

      <div className="mt-4">
        <p className="text-sm font-medium text-steel">{t('sellerPayments.recentActivity')}</p>
        {entries.length === 0 ? (
          <p className="mt-2 text-sm text-steel">{t('sellerPayments.noActivity')}</p>
        ) : (
          <ul className="mt-2 divide-y divide-steel/10">
            {entries.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <div>
                  <p className="text-ink">{t(ENTRY_TYPE_LABEL_KEY[entry.type])}</p>
                  <p className="text-xs text-steel">{new Date(entry.createdAt).toLocaleDateString()}</p>
                </div>
                <span className={`font-mono ${entry.direction === 'credit' ? 'text-verify' : 'text-alert'}`}>
                  {entry.direction === 'credit' ? '+' : '-'}
                  {formatINR(entry.amountPaise)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
