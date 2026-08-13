import type { PriceCartResult } from '@snapspare/shared'
import { formatINR } from '@snapspare/shared'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'

interface OrderSummaryRowProps {
  label: string
  value: string
  emphasis?: boolean
  muted?: boolean
}

function SummaryRow({ label, value, emphasis, muted }: OrderSummaryRowProps) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className={muted ? 'text-steel' : 'text-ink'}>{label}</span>
      <span className={emphasis ? 'font-mono text-lg font-semibold text-ink' : 'font-mono text-ink'}>{value}</span>
    </div>
  )
}

interface OrderSummaryProps {
  result: PriceCartResult
  onCheckout: () => void
  checkoutDisabled?: boolean
}

/**
 * Cart-level totals (design spec item 6): subtotal, discount, per-seller
 * shipping, taxable value, CGST/SGST or IGST shown as separate lines, grand
 * total. Every figure is read straight off priceCart's response — this
 * component does no money math of its own.
 */
export function OrderSummary({ result, onCheckout, checkoutDisabled }: OrderSummaryProps) {
  const { t } = useTranslation()

  return (
    <aside className="space-y-3 rounded-[6px] border border-steel/20 bg-surface p-4">
      <h2 className="font-heading text-lg font-semibold text-ink">{t('cart.summary.title')}</h2>

      <div className="space-y-1.5">
        <SummaryRow label={t('cart.summary.subtotal')} value={formatINR(result.subtotalPaise)} />
        {result.discountPaise > 0 ? (
          <SummaryRow label={t('cart.summary.discount')} value={`-${formatINR(result.discountPaise)}`} />
        ) : null}

        {result.sellerGroups.length > 1 ? (
          <div className="space-y-1 pl-3">
            {result.sellerGroups.map((group) => (
              <SummaryRow
                key={group.sellerId}
                muted
                label={t('cart.summary.shippingFor', { seller: group.sellerName })}
                value={group.shippingPaise === 0 ? t('cart.freeShipping.free') : formatINR(group.shippingPaise)}
              />
            ))}
          </div>
        ) : (
          <SummaryRow
            label={t('cart.summary.shipping')}
            value={result.shippingPaise === 0 ? t('cart.freeShipping.free') : formatINR(result.shippingPaise)}
          />
        )}

        <SummaryRow label={t('cart.summary.taxableValue')} value={formatINR(result.taxableValuePaise)} />

        {result.cgstPaise > 0 ? <SummaryRow muted label={t('cart.summary.cgst')} value={formatINR(result.cgstPaise)} /> : null}
        {result.sgstPaise > 0 ? <SummaryRow muted label={t('cart.summary.sgst')} value={formatINR(result.sgstPaise)} /> : null}
        {result.igstPaise > 0 ? <SummaryRow muted label={t('cart.summary.igst')} value={formatINR(result.igstPaise)} /> : null}
      </div>

      <div className="border-t border-steel/10 pt-2">
        <SummaryRow emphasis label={t('cart.summary.total')} value={formatINR(result.totalPaise)} />
      </div>

      {result.notices.some((notice) => notice.code === 'no_shipping_address') ? (
        <p className="text-xs text-steel">{t('cart.notices.noShippingAddress')}</p>
      ) : null}

      <Button type="button" variant="cta" className="w-full" disabled={checkoutDisabled} onClick={onCheckout}>
        {t('cart.checkout')}
      </Button>
    </aside>
  )
}
