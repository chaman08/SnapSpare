import type { Rfq, RfqQuote } from '@snapspare/shared'
import { formatINR } from '@snapspare/shared'
import { MessageSquare, Star } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { estimateLandedCost } from '@/features/rfq/lib/landedCost'
import { RfqQuoteStatusPill } from '@/features/rfq/components/RfqStatusPill'

interface RfqQuoteComparisonTableProps {
  rfq: Rfq
  quotes: RfqQuote[]
  onAccept: (quote: RfqQuote) => void
  onOpenThread: (quote: RfqQuote) => void
  /** Admin's read-only detail view: shows every quote but hides the Accept action (only the owning buyer may accept). */
  readOnly?: boolean
}

/**
 * Requirement 4: all quotes side by side with landed cost, seller rating and
 * lead time. `sellers/{sellerId}` isn't buyer-readable (see
 * lib/landedCost.ts's header comment) so rating/name come from the quote's
 * own denormalized fields, and the tax/total figures are labeled as
 * estimates — the true landed cost locks in server-side at accept.
 */
export function RfqQuoteComparisonTable({ rfq, quotes, onAccept, onOpenThread, readOnly }: RfqQuoteComparisonTableProps) {
  const { t } = useTranslation()

  const pending = quotes.filter((q) => q.status === 'pending').sort((a, b) => a.unitPricePaise - b.unitPricePaise)
  const others = quotes.filter((q) => q.status !== 'pending')
  const canAccept = !readOnly && (rfq.status === 'open' || rfq.status === 'quoted')

  if (quotes.length === 0) {
    return <p className="text-sm text-steel">{t('rfq.detail.noQuotesYet')}</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('rfq.compare.seller')}</TableHead>
          <TableHead>{t('rfq.compare.unitPrice')}</TableHead>
          <TableHead>{t('rfq.compare.qty')}</TableHead>
          <TableHead>{t('rfq.compare.leadTime')}</TableHead>
          <TableHead>{t('rfq.compare.landedCost')}</TableHead>
          <TableHead>{t('rfq.compare.status')}</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {[...pending, ...others].map((quote) => {
          const estimate = estimateLandedCost(quote)
          return (
            <TableRow key={quote.id}>
              <TableCell>
                <p className="font-medium text-ink">{quote.sellerName}</p>
                <p className="inline-flex items-center gap-1 text-xs text-steel">
                  <Star className="h-3 w-3 fill-signal text-signal" aria-hidden="true" />
                  {quote.sellerRatingCount > 0 ? `${quote.sellerRatingAvg.toFixed(1)} (${quote.sellerRatingCount})` : t('product.newSeller')}
                </p>
              </TableCell>
              <TableCell className="font-mono tabular-nums">{formatINR(quote.unitPricePaise)}</TableCell>
              <TableCell className="font-mono tabular-nums">{quote.qtyOffered}</TableCell>
              <TableCell>{quote.leadTimeDays !== undefined ? t('rfq.compare.leadTimeDays', { count: quote.leadTimeDays }) : '—'}</TableCell>
              <TableCell className="font-mono tabular-nums">
                {estimate.totalEstimatePaise !== undefined ? (
                  <>
                    {formatINR(estimate.totalEstimatePaise)}
                    <span className="ml-1 text-xs text-steel">{t('rfq.compare.estBadge')}</span>
                  </>
                ) : (
                  <span className="text-xs text-steel">{formatINR(estimate.subtotalPaise)} {t('rfq.compare.plusTaxShipping')}</span>
                )}
              </TableCell>
              <TableCell>
                <RfqQuoteStatusPill status={quote.status} />
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => onOpenThread(quote)} aria-label={t('rfq.compare.openThread')}>
                    <MessageSquare className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  {quote.status === 'pending' && canAccept ? (
                    <Button type="button" variant="cta" size="sm" onClick={() => onAccept(quote)}>
                      {t('rfq.compare.accept')}
                    </Button>
                  ) : null}
                </div>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
