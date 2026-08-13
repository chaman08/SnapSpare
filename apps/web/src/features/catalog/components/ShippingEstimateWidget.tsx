import type { DimensionsCm } from '@snapspare/shared'
import { formatINR, pincodeSchema } from '@snapspare/shared'
import { PackageSearch, Truck } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useShippingRates } from '@/features/checkout/api/getShippingRates'
import { cn } from '@/lib/utils'

interface ShippingEstimateWidgetProps {
  sellerId: string
  weightGrams: number
  dimensionsCm?: DimensionsCm
  className?: string
}

/**
 * Product-page rate/serviceability preview (design brief item 2) — a buyer
 * types their pincode before adding to cart and sees real courier
 * options/ETA for this one seller, backed by getShippingRates.ts's
 * cached provider call. Distinct from the cart/checkout's authoritative
 * per-seller charge (priceCart), which only appears once items are
 * actually in the cart with a saved address.
 */
export function ShippingEstimateWidget({ sellerId, weightGrams, dimensionsCm, className }: ShippingEstimateWidgetProps) {
  const { t } = useTranslation()
  const [pincodeInput, setPincodeInput] = useState('')
  const [checkedPincode, setCheckedPincode] = useState<string | null>(null)

  const isValidPincode = pincodeSchema.safeParse(pincodeInput).success
  const query = useShippingRates(
    checkedPincode ? { sellerId, destPincode: checkedPincode, weightGrams, dimensionsCm } : null,
  )

  function handleCheck() {
    if (isValidPincode) setCheckedPincode(pincodeInput)
  }

  return (
    <div className={cn('space-y-2 rounded-[6px] border border-steel/20 p-3', className)}>
      <div className="flex items-center gap-2 text-sm font-medium text-ink">
        <Truck className="h-4 w-4 shrink-0" aria-hidden="true" />
        {t('product.shippingEstimate.title')}
      </div>

      <div className="flex gap-2">
        <label htmlFor="shipping-estimate-pincode" className="sr-only">
          {t('product.shippingEstimate.pincodeLabel')}
        </label>
        <input
          id="shipping-estimate-pincode"
          inputMode="numeric"
          maxLength={6}
          placeholder={t('product.shippingEstimate.pincodePlaceholder')}
          value={pincodeInput}
          onChange={(event) => setPincodeInput(event.target.value.replace(/\D/g, ''))}
          onKeyDown={(event) => event.key === 'Enter' && handleCheck()}
          className="min-h-tap w-32 rounded-[6px] border border-steel/30 bg-surface px-2 font-mono text-base text-ink"
        />
        <Button type="button" variant="outline" size="sm" disabled={!isValidPincode} onClick={handleCheck}>
          {t('product.shippingEstimate.check')}
        </Button>
      </div>

      {checkedPincode && query.isLoading ? <Skeleton className="h-16 w-full" /> : null}

      {checkedPincode && query.isError ? (
        <p role="alert" className="text-sm text-alert">
          {t('product.shippingEstimate.error')}
        </p>
      ) : null}

      {checkedPincode && query.data && !query.isLoading ? (
        query.data.serviceable ? (
          <ul className="space-y-1.5" aria-live="polite">
            {query.data.quotes.map((quote) => (
              <li key={quote.courier} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-steel">{quote.courier}</span>
                <span className="text-ink">
                  {formatINR(quote.ratePaise)} ·{' '}
                  {t('cart.deliveryEtaRange', { min: quote.etaDaysMin, max: quote.etaDaysMax })}
                  {quote.codAvailable ? ` · ${t('product.shippingEstimate.codAvailable')}` : ''}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p role="alert" className="flex items-center gap-1.5 text-sm text-alert">
            <PackageSearch className="h-4 w-4 shrink-0" aria-hidden="true" />
            {t('product.shippingEstimate.notServiceable')}
          </p>
        )
      ) : null}
    </div>
  )
}
