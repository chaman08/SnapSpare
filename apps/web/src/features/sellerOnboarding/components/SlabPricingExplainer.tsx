import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

const EXAMPLE_TIERS = [
  { label: '1-9', heightPercent: 100 },
  { label: '10-49', heightPercent: 78 },
  { label: '50+', heightPercent: 58 },
]

/**
 * Landing-page explainer for quantity-slab pricing, in the same stepped-bar
 * visual language as the real PriceLadder (features/catalog/components/PriceLadder.tsx)
 * shown on product pages — but built from a fixed illustrative example, not
 * a real listing's pricing, since there's no seller/listing yet at this point.
 */
export function SlabPricingExplainer() {
  const { t } = useTranslation()

  return (
    <section className="space-y-4 rounded-[6px] border border-steel/20 bg-surface p-5">
      <h2 className="font-heading text-xl font-semibold text-ink">{t('sell.landing.slabPricing.title')}</h2>
      <p className="text-base text-steel">{t('sell.landing.slabPricing.description')}</p>

      <div aria-hidden="true" className="flex h-32 items-end gap-3">
        {EXAMPLE_TIERS.map((tier, index) => (
          <div key={tier.label} className="flex h-full flex-1 flex-col items-stretch justify-end gap-1">
            <span className="text-center text-xs font-medium text-steel">{t('sell.landing.slabPricing.qtyLabel', { range: tier.label })}</span>
            <div
              style={{ height: `${tier.heightPercent}%` }}
              className={cn(
                'w-full rounded-t-[4px] border',
                index === EXAMPLE_TIERS.length - 1 ? 'border-signal bg-signal/80' : 'border-steel/30 bg-surface-muted',
              )}
            />
          </div>
        ))}
      </div>
      <p className="text-sm text-ink">{t('sell.landing.slabPricing.example')}</p>
    </section>
  )
}
