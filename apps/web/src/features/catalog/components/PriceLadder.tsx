import type { BuyerType, GstRatePercent, ListingPricing } from '@snapspare/shared'
import { formatINR } from '@snapspare/shared'
import { Lock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import type { GstDisplayMode } from '@/features/catalog/lib/gstDisplay'
import { isBusinessBuyerType, toDisplayUnitPrice } from '@/features/catalog/lib/gstDisplay'
import { nextTier, tierForQty } from '@/features/catalog/lib/pricingTiers'
import { cn } from '@/lib/utils'

interface PriceLadderProps {
  pricing: ListingPricing
  qty: number
  onSelectQty: (qty: number) => void
  buyerType?: BuyerType
  mrpPaise?: number
  gstRatePercent: GstRatePercent
  taxIncluded: boolean
  gstDisplayMode: GstDisplayMode
  className?: string
}

const MIN_BAR_HEIGHT_PERCENT = 30

/** Proportional width (as a fraction) for each tier, using each finite tier's own quantity range and, for the open-ended last tier, the previous tier's range size (or its own minQty if it's the only tier) as a stand-in "visual" range. */
function tierWidthFractions(pricing: ListingPricing): number[] {
  const sizes = pricing.tiers.map((tier, index) => {
    if (tier.maxQty !== null) return tier.maxQty - tier.minQty + 1
    const previous = pricing.tiers[index - 1]
    return previous && previous.maxQty !== null ? previous.maxQty - previous.minQty + 1 : tier.minQty
  })
  const total = sizes.reduce((sum, size) => sum + size, 0)
  return sizes.map((size) => (total > 0 ? size / total : 1 / sizes.length))
}

/**
 * Design system signature element: the quantity-slab pricing ladder.
 * Renders a stepped bar (height = unit price, width = quantity range, the
 * tier covering the current qty filled, the next-cheaper tier outlined in
 * --signal) plus a plain-language "buy N more, save X" line, running
 * savings totals, and — for business buyer types — the wholesale ladder in
 * full; retail buyers (or signed-out visitors) see only the single-unit
 * price and a locked row pointing at GSTIN verification. Everything the
 * bar shows is duplicated in a screen-reader-only table, and quantity
 * changes are announced via aria-live.
 */
export function PriceLadder({
  pricing,
  qty,
  onSelectQty,
  buyerType,
  mrpPaise,
  gstRatePercent,
  taxIncluded,
  gstDisplayMode,
  className,
}: PriceLadderProps) {
  const { t } = useTranslation()
  const isBusiness = isBusinessBuyerType(buyerType)
  const activeTier = tierForQty(pricing, qty)
  const upcoming = nextTier(pricing, qty)
  const firstTier = pricing.tiers[0]

  const displayPrice = (unitPricePaise: number) =>
    toDisplayUnitPrice(unitPricePaise, gstRatePercent, taxIncluded, gstDisplayMode)
  const inclusivePrice = (unitPricePaise: number) =>
    toDisplayUnitPrice(unitPricePaise, gstRatePercent, taxIncluded, 'inclusive')

  const activeDisplay = displayPrice(activeTier.unitPricePaise)
  const tier1Display = firstTier ? displayPrice(firstTier.unitPricePaise) : activeDisplay

  const savingsVsTier1 = Math.max(0, (tier1Display - activeDisplay) * qty)
  const activeInclusive = inclusivePrice(activeTier.unitPricePaise)
  const savingsVsMrp = mrpPaise && mrpPaise > activeInclusive ? (mrpPaise - activeInclusive) * qty : 0

  const visibleTiers = isBusiness ? pricing.tiers : firstTier ? [firstTier] : []
  const widthFractions = tierWidthFractions(pricing)
  const maxPrice = Math.max(...pricing.tiers.map((tier) => tier.unitPricePaise))

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-steel">{t('product.detail.ladder.title')}</p>
        {isBusiness ? (
          <span className="rounded-full bg-verify/10 px-2 py-0.5 text-xs font-semibold text-verify">
            {t('product.detail.ladder.businessChip', { type: t(`auth.buyerType.${buyerType}`) })}
          </span>
        ) : null}
      </div>

      {/* Decorative stepped bar — the accessible twin (table) below carries the same data for screen readers.
          aria-hidden hides these buttons/link from assistive tech but does NOT remove them from the tab
          order by itself, which would otherwise leave a keyboard user tabbing onto controls a screen
          reader never announces — tabIndex={-1} below closes that gap. */}
      <div aria-hidden="true" className="flex h-24 items-end gap-1">
        {visibleTiers.map((tier, index) => {
          const isActive = tier.minQty === activeTier.minQty
          const isNext = upcoming ? tier.minQty === upcoming.minQty : false
          const heightPercent = Math.max(MIN_BAR_HEIGHT_PERCENT, (tier.unitPricePaise / maxPrice) * 100)
          return (
            <button
              key={tier.minQty}
              type="button"
              tabIndex={-1}
              onClick={() => onSelectQty(tier.minQty)}
              style={{ flexBasis: `${(widthFractions[index] ?? 1 / visibleTiers.length) * 100}%` }}
              className="group flex h-full flex-col items-stretch justify-end gap-1 focus-visible:outline-none"
            >
              <span className="text-center font-mono text-[11px] tabular-nums text-steel">
                {formatINR(displayPrice(tier.unitPricePaise))}
              </span>
              <span
                style={{ height: `${heightPercent}%` }}
                className={cn(
                  'w-full rounded-t-[4px] border transition-colors',
                  isActive
                    ? 'border-signal bg-signal'
                    : isNext
                      ? 'border-2 border-signal bg-surface'
                      : 'border-steel/30 bg-surface-muted group-hover:bg-steel/20',
                )}
              />
            </button>
          )
        })}

        {!isBusiness && pricing.tiers.length > 1 ? (
          <Link
            to="/account"
            tabIndex={-1}
            style={{ flexBasis: `${100 - (widthFractions[0] ?? 0) * 100}%` }}
            className="flex h-full flex-col items-stretch justify-end gap-1 opacity-50 hover:opacity-70"
          >
            <Lock className="mx-auto h-3.5 w-3.5 text-steel" aria-hidden="true" />
            <span
              style={{ height: `${MIN_BAR_HEIGHT_PERCENT}%` }}
              className="w-full rounded-t-[4px] border border-dashed border-steel/40 bg-surface-muted"
            />
          </Link>
        ) : null}
      </div>

      <p aria-live="polite" className="sr-only">
        {t('product.detail.ladder.priceAnnouncement', { qty, price: formatINR(activeDisplay) })}
      </p>

      <p className="text-sm text-ink">
        {t('product.detail.ladder.payLine', { price: formatINR(activeDisplay) })}
        {isBusiness && upcoming ? (
          <>
            {' · '}
            <button
              type="button"
              onClick={() => onSelectQty(upcoming.minQty)}
              className="text-verify underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
            >
              {t('product.detail.ladder.nextTierLine', {
                count: upcoming.minQty - qty,
                price: formatINR(displayPrice(upcoming.unitPricePaise)),
                savings: formatINR((activeDisplay - displayPrice(upcoming.unitPricePaise)) * upcoming.minQty),
              })}
            </button>
          </>
        ) : null}
      </p>

      {!isBusiness ? (
        <Link
          to="/account"
          className="block rounded-[6px] border border-dashed border-steel/40 bg-surface-muted px-3 py-2 text-xs text-steel hover:text-ink"
        >
          <span className="inline-flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5" aria-hidden="true" />
            {t('product.detail.ladder.lockedTitle')}
          </span>
          <span className="ml-5 block text-signal">{t('product.detail.ladder.lockedCta')}</span>
        </Link>
      ) : null}

      {savingsVsMrp > 0 || savingsVsTier1 > 0 ? (
        <ul className="space-y-0.5 text-xs text-verify">
          {savingsVsMrp > 0 ? (
            <li>{t('product.detail.ladder.savingsVsMrp', { amount: formatINR(savingsVsMrp) })}</li>
          ) : null}
          {savingsVsTier1 > 0 ? (
            <li>{t('product.detail.ladder.savingsVsTier1', { amount: formatINR(savingsVsTier1) })}</li>
          ) : null}
        </ul>
      ) : null}

      <table className="sr-only">
        <caption>{t('product.detail.ladder.tableCaption')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('product.detail.ladder.tableQtyRange')}</th>
            <th scope="col">{t('product.detail.ladder.tableUnitPrice')}</th>
          </tr>
        </thead>
        <tbody>
          {(isBusiness ? pricing.tiers : firstTier ? [firstTier] : []).map((tier) => (
            <tr key={tier.minQty}>
              <td>
                {tier.maxQty === null
                  ? t('product.detail.tierFrom', { min: tier.minQty })
                  : t('product.detail.tierRange', { min: tier.minQty, max: tier.maxQty })}
              </td>
              <td>{formatINR(displayPrice(tier.unitPricePaise))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
