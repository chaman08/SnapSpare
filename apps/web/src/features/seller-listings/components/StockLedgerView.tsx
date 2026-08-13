import type { StockAdjustReason } from '@snapspare/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/states/EmptyState'
import { ErrorState } from '@/components/states/ErrorState'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { adjustStock, useStockLedger } from '@/features/seller-listings/api/adjustStock'

/** Matches adjustStockRequestSchema's narrower reason enum — 'sale'/'return' are only ever posted by order-lifecycle transactions, never a manual adjustment. */
type ManualAdjustReason = 'restock' | 'adjustment' | 'correction'
const ADJUST_REASONS: ManualAdjustReason[] = ['restock', 'adjustment', 'correction']

const REASON_BADGE: Record<StockAdjustReason, string> = {
  restock: 'bg-verify/10 text-verify',
  sale: 'bg-ink/10 text-ink',
  return: 'bg-signal/10 text-signal',
  adjustment: 'bg-steel/10 text-steel',
  correction: 'bg-steel/10 text-steel',
  replacement: 'bg-signal/10 text-signal',
}

interface StockLedgerViewProps {
  listingId: string
  sellerId: string
  onAdjusted?: () => void
}

/** Manual adjustment form + the movement history table (requirement 5's stock ledger view). */
export function StockLedgerView({ listingId, sellerId, onAdjusted }: StockLedgerViewProps) {
  const { t } = useTranslation()
  const { data: entries, isLoading, isError, refetch } = useStockLedger(listingId, sellerId)
  const [deltaText, setDeltaText] = useState('')
  const [reason, setReason] = useState<ManualAdjustReason>('restock')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleAdjust() {
    const deltaQty = Number(deltaText)
    if (!Number.isInteger(deltaQty) || deltaQty === 0) return
    setBusy(true)
    try {
      await adjustStock({ listingId, deltaQty, reason, note: note || undefined })
      setDeltaText('')
      setNote('')
      toast.success(t('sellerListings.inventory.adjustSuccess'))
      await refetch()
      onAdjusted?.()
    } catch (error) {
      const message = (error as { message?: string } | null)?.message ?? ''
      toast.error(
        message === 'insufficient_stock' ? t('sellerListings.inventory.insufficientStock') : t('common.somethingWentWrong'),
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2 rounded-[6px] border border-steel/20 p-3">
        <div className="space-y-1.5">
          <Label htmlFor="adjust-delta">{t('sellerListings.inventory.adjustDeltaLabel')}</Label>
          <Input
            id="adjust-delta"
            type="number"
            inputMode="numeric"
            placeholder={t('sellerListings.inventory.adjustDeltaPlaceholder')}
            value={deltaText}
            onChange={(e) => setDeltaText(e.target.value)}
            className="w-32"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="adjust-reason">{t('sellerListings.inventory.adjustReasonLabel')}</Label>
          <select
            id="adjust-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value as ManualAdjustReason)}
            className="flex min-h-tap rounded-[6px] border border-steel/30 bg-surface px-3 text-base text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
          >
            {ADJUST_REASONS.map((r) => (
              <option key={r} value={r}>
                {t(`sellerListings.inventory.reason.${r}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[10rem] flex-1 space-y-1.5">
          <Label htmlFor="adjust-note">{t('sellerListings.inventory.adjustNoteLabel')}</Label>
          <Input id="adjust-note" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <Button type="button" variant="cta" disabled={busy || !deltaText} onClick={handleAdjust}>
          {t('sellerListings.inventory.adjustAction')}
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : !entries || entries.length === 0 ? (
        <EmptyState title={t('sellerListings.inventory.ledgerEmptyTitle')} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('sellerListings.inventory.date')}</TableHead>
              <TableHead>{t('sellerListings.inventory.reasonColumn')}</TableHead>
              <TableHead>{t('sellerListings.inventory.delta')}</TableHead>
              <TableHead>{t('sellerListings.inventory.balance')}</TableHead>
              <TableHead>{t('sellerListings.inventory.note')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="whitespace-nowrap text-xs text-steel">
                  {new Date(entry.createdAt).toLocaleString()}
                </TableCell>
                <TableCell>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${REASON_BADGE[entry.reason]}`}>
                    {t(`sellerListings.inventory.reason.${entry.reason}`)}
                  </span>
                </TableCell>
                <TableCell className={`font-mono ${entry.deltaQty < 0 ? 'text-alert' : 'text-verify'}`}>
                  {entry.deltaQty > 0 ? `+${entry.deltaQty}` : entry.deltaQty}
                </TableCell>
                <TableCell className="font-mono">{entry.balanceAfter ?? '—'}</TableCell>
                <TableCell className="text-sm text-steel">{entry.note ?? '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
