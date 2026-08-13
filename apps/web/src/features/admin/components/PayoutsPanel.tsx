import { formatINR } from '@snapspare/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { EmptyState } from '@/components/states/EmptyState'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { triggerPayoutRun, useRecentPayouts } from '@/features/admin/api/financeActions'
import { cn } from '@/lib/utils'

const STATUS_STYLES: Record<string, string> = {
  paid: 'bg-verify/10 text-verify',
  processing: 'bg-signal/10 text-signal',
  pending: 'bg-steel/10 text-steel',
  failed: 'bg-alert/10 text-alert',
}

/** Finance module's manual payout trigger + recent payout-run history (design brief item 8). */
export function PayoutsPanel() {
  const { t } = useTranslation()
  const { payouts, loading } = useRecentPayouts()
  const [busy, setBusy] = useState(false)

  async function runTrigger() {
    setBusy(true)
    try {
      const result = await triggerPayoutRun()
      toast.success(t('admin.finance.payouts.triggerSuccess', { count: result.sellersProcessed }))
    } catch {
      toast.error(t('admin.finance.payouts.triggerFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-steel">{t('admin.finance.payouts.description')}</p>
        <Button onClick={runTrigger} disabled={busy}>
          {t('admin.finance.payouts.triggerAction')}
        </Button>
      </div>

      {loading ? (
        <Skeleton className="h-48 w-full" />
      ) : payouts.length === 0 ? (
        <EmptyState title={t('admin.finance.payouts.emptyTitle')} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('admin.finance.payouts.seller')}</TableHead>
              <TableHead>{t('admin.finance.payouts.net')}</TableHead>
              <TableHead>{t('admin.finance.payouts.status')}</TableHead>
              <TableHead>{t('admin.finance.payouts.paidAt')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payouts.map((payout) => (
              <TableRow key={payout.id}>
                <TableCell className="font-mono text-xs">{payout.sellerId}</TableCell>
                <TableCell className="font-mono">{formatINR(payout.netAmountPaise)}</TableCell>
                <TableCell>
                  <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_STYLES[payout.status])}>
                    {t(`admin.finance.payouts.statusValue.${payout.status}`, { defaultValue: payout.status })}
                  </span>
                </TableCell>
                <TableCell className="text-xs text-steel">{payout.paidAt ? new Date(payout.paidAt).toLocaleString('en-IN') : '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
