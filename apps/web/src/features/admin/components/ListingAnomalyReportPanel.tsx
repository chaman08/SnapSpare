import { formatINR } from '@snapspare/shared'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/components/states/EmptyState'
import { ErrorState } from '@/components/states/ErrorState'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useListingAnomalyReport } from '@/features/admin/api/listingAdminActions'

/** Listings module (design brief item 5): price-anomaly + out-of-stock reports. */
export function ListingAnomalyReportPanel() {
  const { t } = useTranslation()
  const { data, isLoading, isError, refetch } = useListingAnomalyReport()

  if (isLoading) return <Skeleton className="h-64 w-full" />
  if (isError || !data) return <ErrorState onRetry={() => refetch()} />

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h2 className="font-heading text-lg font-semibold text-ink">{t('admin.listings.anomaly.priceTitle')}</h2>
        {data.priceAnomalies.length === 0 ? (
          <EmptyState title={t('admin.listings.anomaly.priceEmptyTitle')} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('admin.listings.title')}</TableHead>
                <TableHead>{t('admin.listings.anomaly.mrp')}</TableHead>
                <TableHead>{t('admin.listings.anomaly.sellingPrice')}</TableHead>
                <TableHead>{t('admin.listings.anomaly.direction')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.priceAnomalies.map((row) => (
                <TableRow key={row.listingId}>
                  <TableCell>{row.title}</TableCell>
                  <TableCell className="font-mono">{formatINR(row.mrpPaise)}</TableCell>
                  <TableCell className="font-mono">{formatINR(row.lowestTierUnitPricePaise)}</TableCell>
                  <TableCell className="text-xs">
                    {t(`admin.listings.anomaly.directionValue.${row.direction}`)} ({(row.ratioToMrp * 100).toFixed(0)}%)
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-heading text-lg font-semibold text-ink">{t('admin.listings.anomaly.outOfStockTitle')}</h2>
        {data.outOfStock.length === 0 ? (
          <EmptyState title={t('admin.listings.anomaly.outOfStockEmptyTitle')} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('admin.listings.title')}</TableHead>
                <TableHead>{t('admin.listings.seller')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.outOfStock.map((row) => (
                <TableRow key={row.listingId}>
                  <TableCell>{row.title}</TableCell>
                  <TableCell className="font-mono text-xs">{row.sellerId}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  )
}
