import type { SellerDailyStats, SellerDailyTopPart } from '@snapspare/shared'
import { formatINR } from '@snapspare/shared'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/components/states/EmptyState'
import { ErrorState } from '@/components/states/ErrorState'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

interface TopSellingPartsProps {
  stats: SellerDailyStats[]
  isLoading: boolean
  isError: boolean
  onRetry: () => void
}

const TOP_N = 8

function aggregateTopParts(stats: SellerDailyStats[]): SellerDailyTopPart[] {
  const byPart = new Map<string, SellerDailyTopPart>()
  for (const day of stats) {
    for (const part of day.topParts) {
      const existing = byPart.get(part.partId)
      if (existing) {
        existing.qty += part.qty
        existing.revenuePaise += part.revenuePaise
      } else {
        byPart.set(part.partId, { ...part })
      }
    }
  }
  return Array.from(byPart.values())
    .sort((a, b) => b.revenuePaise - a.revenuePaise)
    .slice(0, TOP_N)
}

export function TopSellingParts({ stats, isLoading, isError, onRetry }: TopSellingPartsProps) {
  const { t } = useTranslation()
  const topParts = useMemo(() => aggregateTopParts(stats), [stats])

  return (
    <section className="rounded-[6px] border border-steel/20 bg-surface p-4" aria-labelledby="top-parts-heading">
      <h2 id="top-parts-heading" className="font-heading text-lg font-semibold text-ink">
        {t('sellerDashboard.topSellingParts.title')}
      </h2>

      <div className="mt-3">
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : isError ? (
          <ErrorState onRetry={onRetry} />
        ) : topParts.length === 0 ? (
          <EmptyState title={t('sellerDashboard.topSellingParts.emptyTitle')} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('sellerDashboard.topSellingParts.part')}</TableHead>
                <TableHead>{t('sellerDashboard.topSellingParts.unitsSold')}</TableHead>
                <TableHead>{t('sellerDashboard.topSellingParts.revenue')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topParts.map((part) => (
                <TableRow key={part.partId}>
                  <TableCell className="max-w-[16rem] truncate">{part.title}</TableCell>
                  <TableCell className="font-mono">{part.qty}</TableCell>
                  <TableCell className="font-mono">{formatINR(part.revenuePaise)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </section>
  )
}
