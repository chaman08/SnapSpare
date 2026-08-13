import type { Listing, PartType, SearchListingDocument } from '@snapspare/shared'
import { formatINR } from '@snapspare/shared'
import { ShieldCheck, Star, Truck, Undo2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

interface SellerComparisonStripProps {
  listings: Listing[]
  ratings: Record<string, SearchListingDocument>
  partType: PartType
  selectedListingId: string
  onSelect: (listingId: string) => void
  recommendedListingId?: string
  className?: string
}

/**
 * Every active listing for this part as a selectable row — this is where a
 * buyer switches which seller's offer BuyBox/StickyBuyBar show. One row is
 * marked "Recommended" (the bestValueScore pick), labelled as exactly that
 * rather than presented as the only option — every row remains individually
 * selectable regardless of the recommendation.
 */
export function SellerComparisonStrip({
  listings,
  ratings,
  partType,
  selectedListingId,
  onSelect,
  recommendedListingId,
  className,
}: SellerComparisonStripProps) {
  const { t } = useTranslation()

  return (
    <div
      role="radiogroup"
      aria-label={t('product.detail.compare.title')}
      className={cn('space-y-2', className)}
    >
      {listings.map((listing) => {
        const rating = ratings[listing.id]
        const isSelected = listing.id === selectedListingId
        const isRecommended = listing.id === recommendedListingId
        const firstTier = listing.pricing.tiers[0]
        const bestTier = listing.pricing.tiers[listing.pricing.tiers.length - 1]

        return (
          <button
            key={listing.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onSelect(listing.id)}
            className={cn(
              'flex w-full flex-col gap-2 rounded-[6px] border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal sm:flex-row sm:items-center sm:gap-4',
              isSelected ? 'border-signal bg-signal/5' : 'border-steel/20 bg-surface hover:bg-surface-muted',
            )}
          >
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-1.5">
                {isRecommended ? (
                  <span className="rounded-full bg-verify/10 px-2 py-0.5 text-xs font-semibold text-verify">
                    {t('product.detail.compare.recommended')}
                  </span>
                ) : null}
                <span className="truncate text-sm font-medium text-ink">
                  {rating?.sellerName || t('product.detail.compare.unnamedSeller')}
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-steel">
                  <Star className="h-3 w-3 fill-signal text-signal" aria-hidden="true" />
                  {rating && rating.maxRating > 0 ? rating.maxRating.toFixed(1) : t('product.newSeller')}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-steel">
                <span className="rounded-full bg-surface-muted px-2 py-0.5 font-medium text-ink">
                  {t(`search.facets.conditionOption.${listing.condition}`)}
                </span>
                <span className="rounded-full bg-surface-muted px-2 py-0.5 font-medium text-ink">
                  {t(`search.facets.partType.${partType}`)}
                </span>
                {listing.warrantyMonths ? (
                  <span className="inline-flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                    {t('product.detail.warrantyMonths', { count: listing.warrantyMonths })}
                  </span>
                ) : null}
                {listing.returnWindowDays ? (
                  <span className="inline-flex items-center gap-1">
                    <Undo2 className="h-3 w-3" aria-hidden="true" />
                    {t('product.detail.returnWindow', { count: listing.returnWindowDays })}
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1">
                  <Truck className="h-3 w-3" aria-hidden="true" />
                  {t('product.deliveryEta', { count: rating?.deliveryEtaDays ?? 3 })}
                </span>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-4 text-right">
              <div>
                <p className="text-[11px] text-steel">{t('product.detail.compare.priceAtQty1')}</p>
                <p className="font-mono text-sm font-semibold text-ink">
                  {firstTier ? formatINR(firstTier.unitPricePaise) : '—'}
                </p>
              </div>
              {bestTier && listing.pricing.tiers.length > 1 ? (
                <div>
                  <p className="text-[11px] text-steel">{t('product.detail.compare.bestSlabPrice')}</p>
                  <p className="font-mono text-sm font-semibold text-signal">{formatINR(bestTier.unitPricePaise)}</p>
                </div>
              ) : null}
            </div>
          </button>
        )
      })}
    </div>
  )
}
