import type { ShippingDimensionsCm } from '@snapspare/shared'
import { computeListingMargin, formatINR, toPaise } from '@snapspare/shared'
import { useQuery } from '@tanstack/react-query'
import { TriangleAlert } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getListingCostPrice } from '@/features/seller-listings/api/costPrice'
import { getCommissionRatePreview } from '@/features/seller-listings/api/getCommissionRatePreview'
import type { SlabPricingValue } from '@/features/seller-listings/components/SlabPricingEditor'

interface MarginCalculatorProps {
  listingId?: string
  categorySlug: string
  pricing: SlabPricingValue
  gstRatePercent: number
  taxIncluded: boolean
  weightGrams?: number
  dimensionsCm?: ShippingDimensionsCm
  isOversized: boolean
  /** Reports the current cost-price value up so the parent form can persist it (via setListingCostPrice) once the listing itself has an id — see ListingCommercialForm's persist() flow. */
  onCostPriceChange: (costPricePaise: number | undefined) => void
}

/**
 * Cost price → per-tier margin %, absolute margin, and margin after
 * commission + estimated shipping (GST excluded from the deduction — see
 * pricing/margin.ts's header comment). Warns in `alert` when a tier's net
 * margin goes negative. `aria-live` on the result table per the project's
 * "aria-live for cart/price updates" bar — margin recalculates on every
 * cost-price or pricing edit.
 */
export function MarginCalculator({
  listingId,
  categorySlug,
  pricing,
  gstRatePercent,
  taxIncluded,
  weightGrams,
  dimensionsCm,
  isOversized,
  onCostPriceChange,
}: MarginCalculatorProps) {
  const { t } = useTranslation()
  const [costRupeesText, setCostRupeesText] = useState('')

  const existingCostQuery = useQuery({
    queryKey: ['listing-cost-price', listingId],
    queryFn: () => getListingCostPrice(listingId as string),
    enabled: Boolean(listingId),
    staleTime: 60_000,
  })

  useEffect(() => {
    if (existingCostQuery.data?.costPricePaise !== undefined) {
      setCostRupeesText(String(existingCostQuery.data.costPricePaise / 100))
    }
  }, [existingCostQuery.data])

  const costPricePaise = costRupeesText === '' ? undefined : toPaise(Number(costRupeesText))

  useEffect(() => {
    onCostPriceChange(costPricePaise)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onCostPriceChange is a callback, not a reactive input.
  }, [costPricePaise])

  const commissionQuery = useQuery({
    queryKey: ['commission-rate-preview', categorySlug],
    queryFn: () => getCommissionRatePreview([categorySlug]),
    enabled: Boolean(categorySlug),
    staleTime: 5 * 60_000,
  })
  const commissionPercent = commissionQuery.data?.rates[categorySlug]?.percent ?? 0

  const breakdown = useMemo(
    () =>
      costPricePaise === undefined
        ? []
        : computeListingMargin({
            costPricePaise,
            tiers: pricing.tiers,
            gstRatePercent,
            taxIncluded,
            commissionPercent,
            weightGrams,
            dimensionsCm,
            isOversized,
          }),
    [costPricePaise, pricing.tiers, gstRatePercent, taxIncluded, commissionPercent, weightGrams, dimensionsCm, isOversized],
  )

  return (
    <div className="space-y-3 rounded-[6px] border border-steel/20 p-3">
      <p className="font-heading text-sm font-semibold text-ink">{t('sellerListings.marginCalculator.title')}</p>

      <div className="max-w-xs space-y-1.5">
        <Label htmlFor="cost-price">{t('sellerListings.marginCalculator.costPriceLabel')}</Label>
        <Input
          id="cost-price"
          type="number"
          min={0}
          step="0.01"
          inputMode="decimal"
          value={costRupeesText}
          onChange={(e) => setCostRupeesText(e.target.value)}
        />
        {commissionQuery.data ? (
          <p className="text-xs text-steel">
            {t('sellerListings.marginCalculator.commissionRateHint', { percent: commissionPercent })}
          </p>
        ) : null}
      </div>

      {costPricePaise === undefined ? (
        <p className="text-sm text-steel">{t('sellerListings.marginCalculator.enterCostPrompt')}</p>
      ) : (
        <div aria-live="polite">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('sellerListings.marginCalculator.tier')}</TableHead>
                <TableHead>{t('sellerListings.marginCalculator.price')}</TableHead>
                <TableHead>{t('sellerListings.marginCalculator.commission')}</TableHead>
                <TableHead>{t('sellerListings.marginCalculator.shipping')}</TableHead>
                <TableHead>{t('sellerListings.marginCalculator.margin')}</TableHead>
                <TableHead>{t('sellerListings.marginCalculator.marginPercent')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {breakdown.map((tier, index) => (
                <TableRow key={`${tier.minQty}-${index}`} className={tier.belowCost ? 'bg-alert/5' : undefined}>
                  <TableCell className="font-mono">
                    {tier.minQty}
                    {tier.maxQty === null ? '+' : `–${tier.maxQty}`}
                  </TableCell>
                  <TableCell className="font-mono">{formatINR(tier.unitPricePaise)}</TableCell>
                  <TableCell className="font-mono">{formatINR(tier.commissionPaise)}</TableCell>
                  <TableCell className="font-mono">{formatINR(tier.estimatedShippingPaise)}</TableCell>
                  <TableCell className={`font-mono ${tier.belowCost ? 'font-semibold text-alert' : ''}`}>
                    {formatINR(tier.marginPaise)}
                  </TableCell>
                  <TableCell className={`font-mono ${tier.belowCost ? 'font-semibold text-alert' : ''}`}>
                    {tier.marginPercent}%
                    {tier.belowCost ? <TriangleAlert className="ml-1 inline h-3.5 w-3.5" aria-hidden="true" /> : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {breakdown.some((tier) => tier.belowCost) ? (
            <p role="alert" className="mt-2 text-sm font-medium text-alert">
              {t('sellerListings.marginCalculator.belowCostWarning')}
            </p>
          ) : null}
          <p className="mt-2 text-xs text-steel">{t('sellerListings.marginCalculator.shippingEstimateNote')}</p>
        </div>
      )}
    </div>
  )
}
