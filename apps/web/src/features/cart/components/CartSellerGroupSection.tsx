import type { PricedSellerGroup } from '@snapspare/shared'
import { formatINR } from '@snapspare/shared'
import { Star, Truck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { CartLineItem } from './CartLineItem'
import { FreeShippingProgress } from './FreeShippingProgress'

interface CartSellerGroupSectionProps {
  group: PricedSellerGroup
  freeShippingThresholdPaise: number
  pendingListingIds: Set<string>
  onQtyChange: (listingId: string, qty: number) => void
  onRemove: (listingId: string) => void
  onSaveForLater: (listingId: string) => void
  onSwitchSeller: (currentListingId: string, newListingId: string, newSellerId: string, qty: number) => void
}

/** One seller's section of the cart (design spec item 3): header with rating and combined delivery ETA, followed by that seller's priced line items and a free-shipping progress bar. */
export function CartSellerGroupSection({
  group,
  freeShippingThresholdPaise,
  pendingListingIds,
  onQtyChange,
  onRemove,
  onSaveForLater,
  onSwitchSeller,
}: CartSellerGroupSectionProps) {
  const { t } = useTranslation()

  return (
    <section className="rounded-[6px] border border-steel/20 bg-surface">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-steel/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <p className="font-medium text-ink">{group.sellerName || t('product.detail.compare.unnamedSeller')}</p>
          <span className="inline-flex items-center gap-1 text-xs text-steel">
            <Star className="h-3.5 w-3.5 fill-signal text-signal" aria-hidden="true" />
            {group.sellerRatingCount > 0 ? `${group.sellerRatingAvg.toFixed(1)} (${group.sellerRatingCount})` : t('product.newSeller')}
          </span>
        </div>
        {group.etaDaysMin !== undefined && group.etaDaysMax !== undefined ? (
          <span className="inline-flex items-center gap-1 text-xs text-steel">
            <Truck className="h-3.5 w-3.5" aria-hidden="true" />
            {group.etaDaysMin === group.etaDaysMax
              ? t('product.deliveryEta', { count: group.etaDaysMin })
              : t('cart.deliveryEtaRange', { min: group.etaDaysMin, max: group.etaDaysMax })}
          </span>
        ) : null}
      </header>

      <ul className="divide-y divide-steel/10 px-4">
        {group.items.map((line) => (
          <CartLineItem
            key={line.listingId}
            line={line}
            disabled={pendingListingIds.has(line.listingId)}
            onQtyChange={(qty) => onQtyChange(line.listingId, qty)}
            onRemove={() => onRemove(line.listingId)}
            onSaveForLater={() => onSaveForLater(line.listingId)}
            onSwitchSeller={(newListingId, newSellerId, qty) =>
              onSwitchSeller(line.listingId, newListingId, newSellerId, qty)
            }
          />
        ))}
      </ul>

      <footer className="space-y-2 border-t border-steel/10 px-4 py-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-steel">{t('cart.summary.shipping')}</span>
          <span className="font-mono text-ink">
            {group.shippingPaise === 0 ? t('cart.freeShipping.free') : formatINR(group.shippingPaise)}
          </span>
        </div>
        {group.viaSurfaceTransport ? <p className="text-xs text-steel">{t('product.oversizedNotice')}</p> : null}
        <FreeShippingProgress
          taxableValuePaise={group.taxableValuePaise}
          thresholdPaise={freeShippingThresholdPaise}
          remainingPaise={group.freeShippingRemainingPaise}
        />
      </footer>
    </section>
  )
}
