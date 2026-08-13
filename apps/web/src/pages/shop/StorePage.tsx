import { buildLocalBusinessJsonLd } from '@snapspare/shared'
import { Star } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { EmptyState } from '@/components/states/EmptyState'
import { ErrorState } from '@/components/states/ErrorState'
import { Skeleton } from '@/components/ui/skeleton'
import { ProductCard } from '@/features/catalog/components/ProductCard'
import { useStoreListings } from '@/features/store/api/useStoreListings'
import { useStoreSeller } from '@/features/store/api/useStoreSeller'
import { SellerTrustBadge } from '@/features/trust/components/SellerTrustBadge'
import { useSeoTags } from '@/lib/seo/useSeoTags'

/** Requirement 7: public store page at /store/:sellerSlug — signed-out safe, only reads the denormalized public-safe settings doc (never gstin/pan/bankAccount) plus this seller's active listing grid via Typesense. */
export default function StorePage() {
  const { t } = useTranslation()
  const { sellerSlug } = useParams<{ sellerSlug: string }>()
  const sellerQuery = useStoreSeller(sellerSlug)
  const listingsQuery = useStoreListings(sellerQuery.data?.sellerId)
  const settings = sellerQuery.data?.settings
  const storeName = settings?.storeName || settings?.businessName || sellerSlug || 'Store'

  useSeoTags({
    title: `${storeName} — SnapSpare`,
    description: settings?.storeDescription ?? `${storeName}'s auto parts store on SnapSpare.`,
    path: `/store/${sellerSlug}`,
    noindex: !sellerQuery.data,
    jsonLd: [
      settings
        ? buildLocalBusinessJsonLd({
            name: storeName,
            url: `${window.location.origin}/store/${sellerSlug}`,
            ratingValue: settings.ratingAvg,
            reviewCount: settings.ratingCount,
          })
        : null,
    ],
  })

  if (sellerQuery.isLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-3 px-4 py-6">
        <Skeleton className="h-24 w-full" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-56 w-full" />
          ))}
        </div>
      </div>
    )
  }

  if (sellerQuery.isError) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6">
        <ErrorState onRetry={() => sellerQuery.refetch()} />
      </div>
    )
  }

  if (!sellerQuery.data) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6">
        <EmptyState title={t('store.notFoundTitle')} description={t('store.notFoundDescription')} />
      </div>
    )
  }

  const resolvedSettings = sellerQuery.data.settings

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
      <div className="rounded-[6px] border border-steel/20 bg-surface p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-heading text-2xl font-semibold text-ink">
            {resolvedSettings.storeName || resolvedSettings.businessName || sellerSlug}
          </h1>
          <SellerTrustBadge tier={resolvedSettings.trustTier} />
        </div>
        {resolvedSettings.ratingCount > 0 ? (
          <div className="mt-1 flex items-center gap-1 text-sm text-steel">
            <Star className="h-4 w-4 fill-signal text-signal" aria-hidden="true" />
            <span>{resolvedSettings.ratingAvg.toFixed(1)}</span>
            <span>({t('store.ratingCount', { count: resolvedSettings.ratingCount })})</span>
          </div>
        ) : null}
        {resolvedSettings.storeDescription ? <p className="mt-2 text-sm text-steel">{resolvedSettings.storeDescription}</p> : null}
        {resolvedSettings.legalName || resolvedSettings.registeredAddress ? (
          <p className="mt-2 text-xs text-steel">
            {resolvedSettings.legalName ? `${t('product.detail.disclosure.soldBy')} ${resolvedSettings.legalName}` : null}
            {resolvedSettings.registeredAddress
              ? ` — ${[resolvedSettings.registeredAddress.line1, resolvedSettings.registeredAddress.city, resolvedSettings.registeredAddress.state, resolvedSettings.registeredAddress.pincode].filter(Boolean).join(', ')}`
              : null}
          </p>
        ) : null}
      </div>

      {listingsQuery.isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-56 w-full" />
          ))}
        </div>
      ) : listingsQuery.isError ? (
        <ErrorState onRetry={() => listingsQuery.refetch()} />
      ) : !listingsQuery.data || listingsQuery.data.length === 0 ? (
        <EmptyState title={t('store.emptyTitle')} />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {listingsQuery.data.map((listing) => (
            <ProductCard key={listing.listingId} listing={listing} />
          ))}
        </div>
      )}
    </div>
  )
}
