import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { EmptyState } from '@/components/states/EmptyState'
import { ErrorState } from '@/components/states/ErrorState'
import { Skeleton } from '@/components/ui/skeleton'
import { useListing } from '@/features/catalog/api/listing'
import { ReservedAvailableBreakdown } from '@/features/seller-listings/components/ReservedAvailableBreakdown'
import { StockLedgerView } from '@/features/seller-listings/components/StockLedgerView'

/** Requirement 5: stock ledger view + reserved-vs-available breakdown for one listing. */
export default function SellerInventoryPage() {
  const { t } = useTranslation()
  const { listingId } = useParams<{ listingId: string }>()
  const listingQuery = useListing(listingId ?? '')

  if (listingQuery.isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-3 px-4 py-6">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (listingQuery.isError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6">
        <ErrorState onRetry={() => listingQuery.refetch()} />
      </div>
    )
  }

  if (!listingQuery.data || !listingId) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6">
        <EmptyState title={t('sellerListings.inventory.notFound')} />
      </div>
    )
  }

  const listing = listingQuery.data

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-ink">{t('sellerListings.inventory.title')}</h1>
        <p className="text-sm text-steel">{listing.title}</p>
      </div>

      <ReservedAvailableBreakdown stockQty={listing.stockQty} reservedStock={listing.reservedStock} />

      <StockLedgerView listingId={listingId} sellerId={listing.sellerId} onAdjusted={() => listingQuery.refetch()} />
    </div>
  )
}
