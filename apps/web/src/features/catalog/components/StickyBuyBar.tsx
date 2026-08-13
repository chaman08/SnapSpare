import type { Listing } from '@snapspare/shared'
import { formatINR } from '@snapspare/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/api/AuthProvider'
import { addItemToCart } from '@/features/cart/api/addToCart'
import { QuantityStepper } from '@/features/catalog/components/QuantityStepper'
import type { GstDisplayMode } from '@/features/catalog/lib/gstDisplay'
import { toDisplayUnitPrice } from '@/features/catalog/lib/gstDisplay'
import { tierForQty } from '@/features/catalog/lib/pricingTiers'

interface StickyBuyBarProps {
  listing: Listing
  qty: number
  onQtyChange: (qty: number) => void
  gstDisplayMode: GstDisplayMode
}

/** Mobile-only (md:hidden) sticky bottom bar mirroring BuyBox's price/qty/add-to-cart for the currently selected listing, so the primary action never scrolls out of reach on a long PDP. */
export function StickyBuyBar({ listing, qty, onQtyChange, gstDisplayMode }: StickyBuyBarProps) {
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
    <div
      className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-2 border-t border-steel/20 bg-surface p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden"
      role="region"
      aria-label={t('product.detail.stickyBuyBar')}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-heading text-lg font-semibold text-ink">{formatINR(displayUnitPrice)}</p>
        <p className="truncate text-xs text-steel">{t('product.detail.priceForQty', { qty })}</p>
      </div>
      <QuantityStepper
        qty={qty}
        min={listing.pricing.moq}
        max={outOfStock ? listing.pricing.moq : maxQty}
        stepQty={listing.pricing.stepQty}
        onChange={onQtyChange}
        className="shrink-0"
      />
      <Button
        type="button"
        variant="cta"
        className="shrink-0"
        disabled={outOfStock || adding}
        onClick={handleAddToCart}
      >
        {outOfStock ? t('product.outOfStock') : t('product.addToCart')}
      </Button>
    </div>
  )
}
