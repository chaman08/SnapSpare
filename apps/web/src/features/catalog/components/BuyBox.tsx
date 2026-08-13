import type { BuyerType, Listing, SearchListingDocument } from '@snapspare/shared'
import { formatINR } from '@snapspare/shared'
import { ShieldCheck, Star, Truck, Undo2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/api/AuthProvider'
import { addItemToCart } from '@/features/cart/api/addToCart'
import { GstToggle } from '@/features/catalog/components/GstToggle'
import { PriceLadder } from '@/features/catalog/components/PriceLadder'
import { QuantityStepper } from '@/features/catalog/components/QuantityStepper'
import type { GstDisplayMode } from '@/features/catalog/lib/gstDisplay'
import { toDisplayUnitPrice } from '@/features/catalog/lib/gstDisplay'
import { tierForQty } from '@/features/catalog/lib/pricingTiers'
import { cn } from '@/lib/utils'

const LOW_STOCK_THRESHOLD = 5

interface BuyBoxProps {
  listing: Listing
  rating?: SearchListingDocument
  buyerType?: BuyerType
  showGstToggle: boolean
  gstDisplayMode: GstDisplayMode
  onGstDisplayModeChange: (mode: GstDisplayMode) => void
  qty: number
  onQtyChange: (qty: number) => void
  className?: string
}

/**
 * The primary above-the-fold purchase surface for whichever listing is
 * currently selected (default: the best-value pick from
 * SellerComparisonStrip). Distinct from the old flat "one card per seller"
 * layout — the comparison strip handles switching sellers; this only ever
 * shows one at a time, which is what StickyBuyBar mirrors on mobile.
 */
export function BuyBox({
  listing,
  rating,
  buyerType,
  showGstToggle,
  gstDisplayMode,
  onGstDisplayModeChange,
  qty,
  onQtyChange,
  className,
}: BuyBoxProps) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [adding, setAdding] = useState(false)

  const activeTier = tierForQty(listing.pricing, qty)
  const displayUnitPrice = toDisplayUnitPrice(
    activeTier.unitPricePaise,
    listing.gstRatePercent,
    listing.taxIncluded,
    gstDisplayMode,
  )
  const outOfStock = listing.stockQty === 0
  const lowStock = !outOfStock && listing.stockQty <= LOW_STOCK_THRESHOLD
  const maxQty = Math.min(listing.maxOrderQty ?? listing.stockQty, listing.stockQty)

  async function handleAddToCart() {
    setAdding(true)
    try {
      await addItemToCart(user?.uid, {
        listingId: listing.id,
        partId: listing.partId,
        sellerId: listing.sellerId,
        qty,
        unitPricePaise: activeTier.unitPricePaise,
        tierMinQtyApplied: activeTier.minQty,
      })
      toast.success(t('product.addedToCart'))
    } catch {
      toast.error(t('common.somethingWentWrong'))
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className={cn('space-y-4 rounded-[6px] border border-steel/20 bg-surface p-4', className)}>
      <div className="flex flex-wrap items-center gap-2 text-xs text-steel">
        {rating?.sellerName ? <span className="font-medium text-ink">{rating.sellerName}</span> : null}
        <span className="inline-flex items-center gap-1">
          <Star className="h-3.5 w-3.5 fill-signal text-signal" aria-hidden="true" />
          {rating && rating.maxRating > 0 ? `${rating.maxRating.toFixed(1)} (${rating.ratingCount})` : t('product.newSeller')}
        </span>
        <span className="rounded-full bg-surface-muted px-2 py-0.5 font-medium text-ink">
          {t(`search.facets.conditionOption.${listing.condition}`)}
        </span>
        {listing.warrantyMonths ? (
          <span className="inline-flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            {t('product.detail.warrantyMonths', { count: listing.warrantyMonths })}
          </span>
        ) : null}
        <span className="ml-auto inline-flex items-center gap-1">
          <Truck className="h-3.5 w-3.5" aria-hidden="true" />
          {t('product.deliveryEta', { count: rating?.deliveryEtaDays ?? 3 })}
        </span>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <span className="font-heading text-3xl font-semibold text-ink">{formatINR(displayUnitPrice)}</span>
          <span className="text-xs text-steel">{t('product.detail.priceForQty', { qty })}</span>
        </div>
        {showGstToggle ? <GstToggle mode={gstDisplayMode} onChange={onGstDisplayModeChange} /> : null}
      </div>
      <p className="-mt-2 text-xs text-steel">
        {t(gstDisplayMode === 'inclusive' ? 'product.detail.gst.activeInclusive' : 'product.detail.gst.activeExclusive')}
      </p>

      <PriceLadder
        pricing={listing.pricing}
        qty={qty}
        onSelectQty={onQtyChange}
        buyerType={buyerType}
        mrpPaise={listing.mrpPaise}
        gstRatePercent={listing.gstRatePercent}
        taxIncluded={listing.taxIncluded}
        gstDisplayMode={gstDisplayMode}
      />

      {outOfStock ? (
        <p className="text-xs font-medium text-alert">{t('product.outOfStock')}</p>
      ) : lowStock ? (
        <p className="text-xs font-medium text-alert">{t('product.lowStock', { count: listing.stockQty })}</p>
      ) : null}

      <div className="flex items-center gap-3">
        <QuantityStepper
          qty={qty}
          min={listing.pricing.moq}
          max={outOfStock ? listing.pricing.moq : maxQty}
          stepQty={listing.pricing.stepQty}
          packLabel={listing.packLabel}
          onChange={onQtyChange}
        />
        <Button
          type="button"
          variant="cta"
          className="flex-1"
          disabled={outOfStock || adding}
          onClick={handleAddToCart}
        >
          {outOfStock ? t('product.outOfStock') : t('product.addToCart')}
        </Button>
      </div>

      {listing.returnWindowDays ? (
        <p className="inline-flex items-center gap-1.5 text-xs text-steel">
          <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
          {t('product.detail.returnWindow', { count: listing.returnWindowDays })}
        </p>
      ) : null}
    </div>
  )
}
