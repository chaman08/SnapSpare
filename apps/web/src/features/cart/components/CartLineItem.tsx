import type { CartLineWarning, PricedCartLine } from '@snapspare/shared'
import { formatINR } from '@snapspare/shared'
import { BookmarkPlus, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Skeleton } from '@/components/ui/skeleton'
import { useListing } from '@/features/catalog/api/listing'
import { FitmentBadge } from '@/features/catalog/components/FitmentBadge'
import { QuantityStepper } from '@/features/catalog/components/QuantityStepper'
import { CrossSellerNudge } from './CrossSellerNudge'
import { TierNudge } from './TierNudge'

function warningI18nProps(warning: CartLineWarning): { key: string; values?: Record<string, unknown> } {
  switch (warning.code) {
    case 'out_of_stock':
      return { key: 'cart.warnings.outOfStock' }
    case 'price_changed':
      return {
        key: 'cart.warnings.priceChanged',
        values: {
          previous: warning.previousUnitPricePaise !== undefined ? formatINR(warning.previousUnitPricePaise) : '',
          next: warning.newUnitPricePaise !== undefined ? formatINR(warning.newUnitPricePaise) : '',
        },
      }
    case 'qty_adjusted_to_moq':
      return { key: 'cart.warnings.qtyAdjustedToMoq', values: { qty: warning.adjustedQty } }
    case 'qty_adjusted_to_step':
      return { key: 'cart.warnings.qtyAdjustedToStep', values: { qty: warning.adjustedQty } }
    case 'qty_capped_to_stock':
      return { key: 'cart.warnings.qtyCappedToStock', values: { qty: warning.adjustedQty } }
    case 'tier_upgraded':
      return { key: 'cart.warnings.tierUpgraded' }
    case 'tier_downgraded':
      return { key: 'cart.warnings.tierDowngraded' }
    default:
      return { key: 'cart.warnings.generic' }
  }
}

interface CartLineItemProps {
  line: PricedCartLine
  onQtyChange: (qty: number) => void
  onRemove: () => void
  onSaveForLater: () => void
  onSwitchSeller: (listingId: string, sellerId: string, qty: number) => void
  disabled?: boolean
}

/**
 * One priced cart line (design spec item 3): image, mono part number,
 * fitment badge, quantity stepper, unit price with tier label, line total.
 * Every price shown here comes straight from the server's priceCart
 * response — the stepper's min/max/step grid is the only thing still read
 * from the live listing doc, since priceCart deliberately doesn't echo back
 * pricing config that isn't money.
 */
export function CartLineItem({ line, onQtyChange, onRemove, onSaveForLater, onSwitchSeller, disabled }: CartLineItemProps) {
  const { t } = useTranslation()
  const listingQuery = useListing(line.listingId)
  const listing = listingQuery.data
  const outOfStock = line.qty === 0

  return (
    <li className="space-y-2 border-b border-steel/10 py-3 last:border-b-0">
      <div className="flex gap-3">
        {line.imageUrl ? (
          <img src={line.imageUrl} alt="" className="h-16 w-16 shrink-0 rounded-[6px] object-cover" />
        ) : (
          <div className="h-16 w-16 shrink-0 rounded-[6px] bg-surface-muted" aria-hidden="true" />
        )}

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate font-medium text-ink">{line.title}</p>
            <button
              type="button"
              onClick={onRemove}
              disabled={disabled}
              aria-label={t('cart.remove')}
              className="flex min-h-tap min-w-tap shrink-0 items-center justify-center rounded-[6px] text-steel hover:bg-surface-muted hover:text-alert disabled:opacity-50"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <p className="font-mono text-xs text-steel">{line.sku}</p>
          <FitmentBadge partId={line.partId} size="sm" />

          {outOfStock ? (
            <p className="text-xs font-medium text-alert">{t('cart.warnings.outOfStock')}</p>
          ) : (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <QuantityStepper
                qty={line.qty}
                min={listing?.pricing.moq ?? 1}
                max={listing ? Math.min(listing.stockQty, listing.maxOrderQty ?? listing.stockQty) : undefined}
                stepQty={listing?.pricing.stepQty ?? 1}
                onChange={onQtyChange}
                className={disabled ? 'pointer-events-none opacity-60' : undefined}
              />
              <p className="font-mono text-sm text-steel">
                {t('cart.unitPriceLine', { price: formatINR(line.unitPricePaise), qty: line.tierMinQtyApplied })}
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={onSaveForLater}
            disabled={disabled}
            className="inline-flex min-h-tap items-center gap-1 text-xs text-steel hover:text-ink disabled:opacity-50"
          >
            <BookmarkPlus className="h-3.5 w-3.5" aria-hidden="true" />
            {t('cart.saveForLater')}
          </button>
        </div>

        <div className="shrink-0 text-right">
          {listingQuery.isLoading ? (
            <Skeleton className="h-6 w-16" />
          ) : (
            <p className="font-mono text-base font-semibold text-ink">{formatINR(line.lineTotalPaise)}</p>
          )}
        </div>
      </div>

      {line.warnings.length > 0 ? (
        <ul aria-live="polite" className="space-y-1">
          {line.warnings.map((warning, index) => {
            const { key, values } = warningI18nProps(warning)
            return (
              <li key={`${warning.code}-${index}`} className="text-xs text-alert">
                {t(key, values)}
              </li>
            )
          })}
        </ul>
      ) : null}

      {line.tierNudge ? <TierNudge nudge={line.tierNudge} onApply={onQtyChange} /> : null}

      {line.cheaperElsewhere ? (
        <CrossSellerNudge
          nudge={line.cheaperElsewhere}
          onSwitch={() => {
            const nudge = line.cheaperElsewhere
            if (nudge) onSwitchSeller(nudge.listingId, nudge.sellerId, line.qty)
          }}
        />
      ) : null}
    </li>
  )
}
