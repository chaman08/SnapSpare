import type { ListingPricing } from '@snapspare/shared'
import { formatINR } from '@snapspare/shared'
import { Minus, Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { nextTier, tierForQty } from '@/features/catalog/lib/pricingTiers'

interface PriceLadderPreviewProps {
  pricing: ListingPricing
}

/**
 * Read-only rendering of the ladder exactly as a buyer would see it —
 * design system's signature "stepped bar with the next tier highlighted"
 * element, driven by a preview quantity the seller can step through. Reuses
 * `features/catalog/lib/pricingTiers.ts`'s `tierForQty`/`nextTier` (the
 * buyer-facing product page's own logic), not a reimplementation, so the
 * preview can never drift from what buyers actually see.
 */
export function PriceLadderPreview({ pricing }: PriceLadderPreviewProps) {
  const { t } = useTranslation()
  const [previewQty, setPreviewQty] = useState(pricing.moq)

  const validTiers = pricing.tiers.filter((tier) => tier.unitPricePaise > 0)
  if (validTiers.length === 0) {
    return <p className="text-sm text-steel">{t('sellerListings.pricingEditor.previewEmpty')}</p>
  }

  const active = tierForQty(pricing, previewQty)
  const upsell = nextTier(pricing, previewQty)

  return (
    <div className="space-y-3 rounded-[6px] border border-steel/20 p-3">
      <p className="font-heading text-sm font-semibold text-ink">{t('sellerListings.pricingEditor.previewTitle')}</p>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => setPreviewQty((q) => Math.max(pricing.moq, q - pricing.stepQty))}
          aria-label={t('sellerListings.pricingEditor.decreasePreviewQty')}
        >
          <Minus className="h-4 w-4" aria-hidden="true" />
        </Button>
        <span aria-live="polite" className="min-w-[3rem] text-center font-mono text-ink">
          {previewQty}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => setPreviewQty((q) => q + pricing.stepQty)}
          aria-label={t('sellerListings.pricingEditor.increasePreviewQty')}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      <ul className="flex flex-wrap gap-1.5" aria-live="polite">
        {pricing.tiers.map((tier, index) => {
          const isActive = tier === active
          return (
            <li
              key={`${tier.minQty}-${index}`}
              className={`rounded-[6px] border px-2.5 py-1.5 text-xs ${
                isActive ? 'border-signal bg-signal/10 font-semibold text-ink' : 'border-steel/20 text-steel'
              }`}
            >
              <span className="font-mono">
                {tier.minQty}
                {tier.maxQty === null ? '+' : `–${tier.maxQty}`}
              </span>
              <span className="ml-1.5 font-mono">{formatINR(tier.unitPricePaise)}</span>
            </li>
          )
        })}
      </ul>

      {upsell ? (
        <p className="text-xs text-steel" aria-live="polite">
          {t('sellerListings.pricingEditor.upsellHint', {
            qty: upsell.minQty - previewQty,
            price: formatINR(upsell.unitPricePaise),
          })}
        </p>
      ) : null}
    </div>
  )
}
