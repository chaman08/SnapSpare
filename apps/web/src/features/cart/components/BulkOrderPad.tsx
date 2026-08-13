import type { BulkOrderMatchedRow, BulkOrderUnmatchedRow } from '@snapspare/shared'
import { formatINR } from '@snapspare/shared'
import { Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/api/AuthProvider'
import { resolveBulkOrder } from '@/features/cart/api/bulkOrderPad'
import { addItemToCart } from '@/features/cart/api/addToCart'
import { parseBulkOrderInput } from '@/features/cart/lib/parseBulkOrderInput'

function unmatchedReasonKey(reason: BulkOrderUnmatchedRow['reason']): string {
  switch (reason) {
    case 'not_found':
      return 'cart.bulkPad.unmatchedReasons.notFound'
    case 'out_of_stock':
      return 'cart.bulkPad.unmatchedReasons.outOfStock'
    default:
      return 'cart.bulkPad.unmatchedReasons.invalidRow'
  }
}

interface BulkOrderPadProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Bulk order pad (design spec item 10): paste lines like "OEM123, 10" or
 * upload a CSV of the same shape. Parsing happens client-side
 * (parseBulkOrderInput); resolving part numbers/SKUs to actual listings is
 * server-only (resolveBulkOrder) since it needs live catalog/stock data the
 * client doesn't have.
 */
export function BulkOrderPad({ open, onOpenChange }: BulkOrderPadProps) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [text, setText] = useState('')
  const [resolving, setResolving] = useState(false)
  const [adding, setAdding] = useState(false)
  const [matched, setMatched] = useState<BulkOrderMatchedRow[]>([])
  const [unmatched, setUnmatched] = useState<BulkOrderUnmatchedRow[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleResolve(rawText: string) {
    const { rows, invalidRows } = parseBulkOrderInput(rawText)
    if (rows.length === 0 && invalidRows.length === 0) return

    setResolving(true)
    setMatched([])
    setUnmatched(invalidRows)
    try {
      if (rows.length > 0) {
        const result = await resolveBulkOrder(rows)
        setMatched(result.matched)
        setUnmatched((prev) => [...prev, ...result.unmatched])
      }
    } catch {
      toast.error(t('common.somethingWentWrong'))
    } finally {
      setResolving(false)
    }
  }

  async function handleFileUpload(file: File) {
    const contents = await file.text()
    setText(contents)
    await handleResolve(contents)
  }

  async function handleAddMatched() {
    setAdding(true)
    try {
      for (const row of matched) {
        await addItemToCart(user?.uid, {
          listingId: row.listingId,
          partId: row.partId,
          sellerId: row.sellerId,
          qty: row.resolvedQty,
          unitPricePaise: row.unitPricePaise,
          tierMinQtyApplied: row.tierMinQtyApplied,
        })
      }
      toast.success(t('cart.bulkPad.addedToCart', { count: matched.length }))
      setMatched([])
      setUnmatched([])
      setText('')
    } catch {
      toast.error(t('common.somethingWentWrong'))
    } finally {
      setAdding(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => onOpenChange(true)}
        className="text-sm font-medium text-ink underline-offset-2 hover:underline"
      >
        {t('cart.bulkPad.open')}
      </button>
    )
  }

  return (
    <section className="space-y-3 rounded-[6px] border border-steel/20 bg-surface p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-lg font-semibold text-ink">{t('cart.bulkPad.title')}</h2>
        <button type="button" onClick={() => onOpenChange(false)} className="text-xs text-steel hover:text-ink">
          {t('common.close')}
        </button>
      </div>
      <p className="text-sm text-steel">{t('cart.bulkPad.description')}</p>

      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={t('cart.bulkPad.placeholder')}
        rows={6}
        className="w-full rounded-[6px] border border-steel/30 bg-surface p-3 font-mono text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="cta" disabled={resolving || !text.trim()} onClick={() => handleResolve(text)}>
          {resolving ? t('common.loading') : t('cart.bulkPad.resolve')}
        </Button>
        <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
          <Upload className="h-4 w-4" aria-hidden="true" />
          {t('cart.bulkPad.uploadCsv')}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv,text/plain"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void handleFileUpload(file)
            event.target.value = ''
          }}
        />
      </div>

      {matched.length > 0 ? (
        <div className="space-y-2 rounded-[6px] border border-verify/30 bg-verify/5 p-3">
          <p className="text-sm font-medium text-verify">{t('cart.bulkPad.matchedCount', { count: matched.length })}</p>
          <ul className="space-y-1 text-sm text-ink">
            {matched.map((row) => (
              <li key={row.listingId} className="flex justify-between gap-2">
                <span className="truncate">
                  {row.title} · {t('cart.qty', { qty: row.resolvedQty })}
                </span>
                <span className="shrink-0 font-mono text-steel">{formatINR(row.unitPricePaise)}</span>
              </li>
            ))}
          </ul>
          <Button type="button" variant="cta" size="sm" disabled={adding} onClick={handleAddMatched}>
            {t('cart.bulkPad.addMatched', { count: matched.length })}
          </Button>
        </div>
      ) : null}

      {unmatched.length > 0 ? (
        <div className="space-y-1 rounded-[6px] border border-alert/30 bg-alert/5 p-3">
          <p className="text-sm font-medium text-alert">{t('cart.bulkPad.unmatchedCount', { count: unmatched.length })}</p>
          <ul className="space-y-1 text-sm text-ink">
            {unmatched.map((row, index) => (
              <li key={`${row.raw}-${index}`} className="truncate">
                <span className="font-mono text-xs text-steel">{row.raw}</span> — {t(unmatchedReasonKey(row.reason))}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
