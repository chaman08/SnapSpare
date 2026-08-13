import type { ListingPricing } from '@snapspare/shared'
import { formatINR } from '@snapspare/shared'
import { useTranslation } from 'react-i18next'
import { nextTier, tierForQty } from '@/features/catalog/lib/pricingTiers'
import { cn } from '@/lib/utils'

interface PriceSlabBarProps {
  pricing: ListingPricing
  qty: number
  onSelectTier: (minQty: number) => void
  className?: string
}

/**
 * Design system signature element #2: quantity slabs as a stepped bar with
 * the tier covering the current quantity highlighted. Segments are rendered
 * equal-width rather than proportional to quantity range — the last tier is
 * open-ended (no maxQty), so there's no finite range to proportion against.
 * Each segment doubles as a quick-select control (click a tier to jump `qty`
 * to its minQty), and the gap to the next cheaper tier is called out below.
 */
export function PriceSlabBar({ pricing, qty, onSelectTier, className }: PriceSlabBarProps) {
  const { t } = useTranslation()
  const activeTier = tierForQty(pricing, qty)
  const upcoming = nextTier(pricing, qty)

  return (
    <div className={cn('space-y-1.5', className)}>
      <div role="group" aria-label={t('product.detail.offersTitle')} className="flex gap-1">
        {pricing.tiers.map((tier) => {
          const isActive = tier.minQty === activeTier.minQty
          return (
            <button
              key={tier.minQty}
              type="button"
              aria-pressed={isActive}
              onClick={() => onSelectTier(tier.minQty)}
              className={cn(
                'flex min-h-tap flex-1 flex-col items-center justify-center gap-0.5 rounded-[6px] border px-1.5 py-1.5 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal',
                isActive
                  ? 'border-signal bg-signal/10 text-ink'
                  : 'border-steel/20 bg-surface text-steel hover:bg-surface-muted',
              )}
            >
              <span className="font-mono text-xs tabular-nums">
                {tier.maxQty === null
                  ? t('product.detail.tierFrom', { min: tier.minQty })
                  : t('product.detail.tierRange', { min: tier.minQty, max: tier.maxQty })}
              </span>
              <span className={cn('text-sm font-semibold', isActive ? 'text-signal' : 'text-ink')}>
                {formatINR(tier.unitPricePaise)}
              </span>
            </button>
          )
        })}
      </div>

      {upcoming ? (
        <p className="text-xs text-verify">
          {t('product.detail.nextTierHint', {
            count: upcoming.minQty - qty,
            price: formatINR(upcoming.unitPricePaise),
          })}
        </p>
      ) : null}
    </div>
  )
}
