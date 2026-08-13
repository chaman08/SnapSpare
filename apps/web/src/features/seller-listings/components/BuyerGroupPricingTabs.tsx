import type { BuyerType, GroupPricing, PricingTier } from '@snapspare/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PriceLadderPreview } from '@/features/seller-listings/components/PriceLadderPreview'
import type { SlabPricingValue } from '@/features/seller-listings/components/SlabPricingEditor'
import { SlabPricingEditor } from '@/features/seller-listings/components/SlabPricingEditor'

const BUYER_TYPES: BuyerType[] = ['retail', 'mechanic', 'garage', 'fleet', 'reseller']

interface BuyerGroupPricingTabsProps {
  defaultPricing: SlabPricingValue
  groupPricing: GroupPricing | undefined
  onChange: (groupPricing: GroupPricing | undefined) => void
  onValidityChange: (valid: boolean) => void
}

/**
 * Requirement 3c: per-buyer-group price overrides. `retail` is included as
 * a tab even though it's also the implicit fallback for any buyer type
 * without an override (see `pricing/tiers.ts`'s `resolveTiersForBuyer`) —
 * a seller can still give retail buyers their own explicit ladder distinct
 * from what mechanics/garages see. Each override shares the default
 * ladder's moq/stepQty (`SlabPricingEditor`'s `moqStepQtyEditable={false}`)
 * — only per-tier prices/boundaries differ per group.
 */
export function BuyerGroupPricingTabs({ defaultPricing, groupPricing, onChange, onValidityChange }: BuyerGroupPricingTabsProps) {
  const { t } = useTranslation()
  const [tab, setTab] = useState<BuyerType>('retail')
  const [validityByType, setValidityByType] = useState<Partial<Record<BuyerType, boolean>>>({})

  function reportValidity(next: Partial<Record<BuyerType, boolean>>) {
    setValidityByType(next)
    onValidityChange(Object.values(next).every((v) => v !== false))
  }

  function copyFromDefault(buyerType: BuyerType) {
    onChange({ ...groupPricing, [buyerType]: defaultPricing.tiers })
  }

  function removeOverride(buyerType: BuyerType) {
    const next = { ...groupPricing }
    delete next[buyerType]
    onChange(Object.keys(next).length > 0 ? next : undefined)
    const { [buyerType]: _removed, ...restValidity } = validityByType
    reportValidity(restValidity)
  }

  function updateOverrideTiers(buyerType: BuyerType, tiers: PricingTier[]) {
    onChange({ ...groupPricing, [buyerType]: tiers })
  }

  return (
    <div className="space-y-3">
      <Tabs value={tab} onValueChange={(v) => setTab(v as BuyerType)}>
        <TabsList aria-label={t('sellerListings.buyerGroups.title')}>
          {BUYER_TYPES.map((buyerType) => (
            <TabsTrigger key={buyerType} value={buyerType}>
              {t(`sellerListings.buyerGroups.type.${buyerType}`)}
              {groupPricing?.[buyerType] ? <span className="ml-1 text-signal">•</span> : null}
            </TabsTrigger>
          ))}
        </TabsList>

        {BUYER_TYPES.map((buyerType) => {
          const override = groupPricing?.[buyerType]
          return (
            <TabsContent key={buyerType} value={buyerType}>
              {!override ? (
                <div className="flex flex-wrap items-center gap-3 rounded-[6px] border border-dashed border-steel/30 p-4">
                  <p className="flex-1 text-sm text-steel">{t('sellerListings.buyerGroups.usingDefault')}</p>
                  <Button type="button" variant="outline" size="sm" onClick={() => copyFromDefault(buyerType)}>
                    {t('sellerListings.buyerGroups.copyFromDefault')}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <SlabPricingEditor
                      value={{ moq: defaultPricing.moq, stepQty: defaultPricing.stepQty, tiers: override }}
                      moqStepQtyEditable={false}
                      onChange={(value) => updateOverrideTiers(buyerType, value.tiers)}
                      onValidityChange={(valid) => reportValidity({ ...validityByType, [buyerType]: valid })}
                    />
                    <PriceLadderPreview pricing={{ moq: defaultPricing.moq, stepQty: defaultPricing.stepQty, tiers: override }} />
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeOverride(buyerType)}>
                    {t('sellerListings.buyerGroups.removeOverride')}
                  </Button>
                </div>
              )}
            </TabsContent>
          )
        })}
      </Tabs>
    </div>
  )
}
