import type { PriceCartResult } from '@snapspare/shared'
import { formatINR } from '@snapspare/shared'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'

interface SummaryRowProps {
  label: string
  value: string
  emphasis?: boolean
  muted?: boolean
}

function SummaryRow({ label, value, emphasis, muted }: SummaryRowProps) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className={muted ? 'text-steel' : 'text-ink'}>{label}</span>
      <span className={emphasis ? 'font-mono text-lg font-semibold text-ink' : 'font-mono text-ink'}>{value}</span>
    </div>
  )
}

interface CheckoutOrderSummaryProps {
  result: PriceCartResult
  codFeePaise: number
  onPlaceOrder: () => void
  placing: boolean
  disabled: boolean
}

/** Checkout's order summary — identical figures to the cart page's OrderSummary (same server-priced result), plus the disclosed COD fee when that's the selected method, and the "Place order" action instead of "Checkout". */
export function CheckoutOrderSummary({ result, codFeePaise, onPlaceOrder, placing, disabled }: CheckoutOrderSummaryProps) {
  const { t } = useTranslation()
  const totalPaise = result.totalPaise + codFeePaise

  return (
    <aside className="space-y-3 rounded-[6px] border border-steel/20 bg-surface p-4">
      <h2 className="font-heading text-lg font-semibold text-ink">{t('cart.summary.title')}</h2>

      <div className="space-y-1.5">
        <SummaryRow label={t('cart.summary.subtotal')} value={formatINR(result.subtotalPaise)} />
        {result.discountPaise > 0 ? (
          <SummaryRow label={t('cart.summary.discount')} value={`-${formatINR(result.discountPaise)}`} />
        ) : null}
        <SummaryRow
          label={t('cart.summary.shipping')}
          value={result.shippingPaise === 0 ? t('cart.freeShipping.free') : formatINR(result.shippingPaise)}
        />
        <SummaryRow label={t('cart.summary.taxableValue')} value={formatINR(result.taxableValuePaise)} />
        {result.cgstPaise > 0 ? <SummaryRow muted label={t('cart.summary.cgst')} value={formatINR(result.cgstPaise)} /> : null}
        {result.sgstPaise > 0 ? <SummaryRow muted label={t('cart.summary.sgst')} value={formatINR(result.sgstPaise)} /> : null}
        {result.igstPaise > 0 ? <SummaryRow muted label={t('cart.summary.igst')} value={formatINR(result.igstPaise)} /> : null}
        {codFeePaise > 0 ? <SummaryRow label={t('checkout.payment.cod.title')} value={formatINR(codFeePaise)} /> : null}
      </div>

      <div className="border-t border-steel/10 pt-2">
        <SummaryRow emphasis label={t('cart.summary.total')} value={formatINR(totalPaise)} />
      </div>

      <Button type="button" variant="cta" className="w-full" disabled={disabled || placing} onClick={onPlaceOrder}>
        {placing ? t('common.loading') : t('checkout.placeOrder')}
      </Button>
    </aside>
  )
}
