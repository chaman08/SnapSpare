import type { Payout, PayoutStatus } from '@snapspare/shared'
import { formatINR } from '@snapspare/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { EmptyState } from '@/components/states/EmptyState'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { downloadCsv } from '@/features/seller/api/ewayBillActions'
import { getPayoutStatement } from '@/features/seller/api/payoutActions'

const STATUS_STYLE: Record<PayoutStatus, string> = {
  pending: 'text-steel',
  processing: 'text-signal',
  paid: 'text-verify',
  failed: 'text-alert',
}

interface PayoutHistoryPanelProps {
  payouts: Payout[]
  loading: boolean
}

/** Payout history with a downloadable per-order statement (design brief item 6). */
export function PayoutHistoryPanel({ payouts, loading }: PayoutHistoryPanelProps) {
  const { t } = useTranslation()
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  async function handleDownload(payout: Payout) {
    setDownloadingId(payout.id)
    try {
      const result = await getPayoutStatement({ payoutId: payout.id })
      downloadCsv(result.csv, `payout-${payout.id}.csv`)
    } catch {
      toast.error(t('sellerPayments.statementDownloadFailed'))
    } finally {
      setDownloadingId(null)
    }
  }

  if (loading) return <Skeleton className="h-48 w-full" />
  if (payouts.length === 0) {
    return <EmptyState title={t('sellerPayments.emptyTitle')} description={t('sellerPayments.emptyDescription')} />
  }

  return (
    <div className="space-y-3">
      <h2 className="font-heading text-lg font-semibold text-ink">{t('sellerPayments.payoutHistory')}</h2>
      <ul className="space-y-2">
        {payouts.map((payout) => (
          <li key={payout.id} className="rounded-[6px] border border-steel/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-mono text-sm text-ink">
                  {new Date(payout.periodFrom).toLocaleDateString()} – {new Date(payout.periodTo).toLocaleDateString()}
                </p>
                <p className={`text-xs font-medium uppercase ${STATUS_STYLE[payout.status]}`}>
                  {t(`sellerPayments.status.${payout.status}`)}
                  {payout.utrNumber ? ` · UTR ${payout.utrNumber}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-base font-semibold text-ink">{formatINR(payout.netAmountPaise)}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={downloadingId === payout.id}
                  onClick={() => void handleDownload(payout)}
                >
                  {downloadingId === payout.id ? t('common.loading') : t('sellerPayments.downloadStatement')}
                </Button>
              </div>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-steel sm:grid-cols-4">
              <div>
                <dt>{t('sellerPayments.gross')}</dt>
                <dd className="font-mono text-ink">{formatINR(payout.grossAmountPaise)}</dd>
              </div>
              <div>
                <dt>{t('sellerPayments.commission')}</dt>
                <dd className="font-mono text-ink">{formatINR(payout.commissionPaise)}</dd>
              </div>
              <div>
                <dt>{t('sellerPayments.taxWithheld')}</dt>
                <dd className="font-mono text-ink">{formatINR(payout.tcsPaise + payout.tdsPaise)}</dd>
              </div>
              <div>
                <dt>{t('sellerPayments.orderCount')}</dt>
                <dd className="font-mono text-ink">{payout.subOrderIds.length}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </div>
  )
}
