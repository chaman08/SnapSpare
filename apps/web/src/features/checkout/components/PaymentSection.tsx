import type { CheckoutPaymentMethod } from '@snapspare/shared'
import { formatINR } from '@snapspare/shared'
import { Banknote, CreditCard, Wallet } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'

interface PaymentSectionProps {
  paymentMethod: CheckoutPaymentMethod
  onPaymentMethodChange: (method: CheckoutPaymentMethod) => void
  codEligible: boolean
  codIneligibleReason?: 'disabled' | 'seller_unsupported' | 'over_cap' | 'abuse_flag' | 'oversized'
  codFeePaise: number
  creditEligible: boolean
  creditAvailablePaise?: number
  emiEnabled: boolean
}

/**
 * Checkout section 3 (design spec): UPI-first Razorpay Standard Checkout,
 * COD offered only when every gating condition holds (surfaced here as a
 * disabled option with a reason, not hidden — a buyer who's used COD before
 * shouldn't wonder where it went), and "Pay on credit" only for
 * creditEnabled buyers with sufficient limit. This section only picks the
 * top-level method; Razorpay's own modal (opened from CheckoutPage) is what
 * actually orders UPI/cards/netbanking/wallets/EMI within the 'razorpay'
 * choice.
 */
export function PaymentSection({
  paymentMethod,
  onPaymentMethodChange,
  codEligible,
  codIneligibleReason,
  codFeePaise,
  creditEligible,
  creditAvailablePaise,
  emiEnabled,
}: PaymentSectionProps) {
  const { t } = useTranslation()

  return (
    <RadioGroup
      name="paymentMethod"
      aria-label={t('checkout.payment.selectMethod')}
      value={paymentMethod}
      onValueChange={(next) => onPaymentMethodChange(next as CheckoutPaymentMethod)}
      className="space-y-2"
    >
      <RadioGroupItem value="razorpay">
        <span className="flex items-start gap-2">
          <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-steel" aria-hidden="true" />
          <span>
            <span className="block font-medium text-ink">{t('checkout.payment.online.title')}</span>
            <span className="block text-sm text-steel">{t('checkout.payment.online.description')}</span>
            {emiEnabled ? (
              <span className="mt-1 block text-xs text-verify">{t('checkout.payment.online.emiAvailable')}</span>
            ) : null}
          </span>
        </span>
      </RadioGroupItem>

      <RadioGroupItem value="cod" disabled={!codEligible}>
        <span className="flex items-start gap-2">
          <Banknote className="mt-0.5 h-4 w-4 shrink-0 text-steel" aria-hidden="true" />
          <span>
            <span className="block font-medium text-ink">{t('checkout.payment.cod.title')}</span>
            {codEligible ? (
              <span className="block text-sm text-steel">
                {codFeePaise > 0
                  ? t('checkout.payment.cod.feeNotice', { fee: formatINR(codFeePaise) })
                  : t('checkout.payment.cod.noFee')}
              </span>
            ) : (
              <span className="block text-sm text-steel">
                {t(`checkout.payment.cod.ineligible.${codIneligibleReason ?? 'disabled'}`)}
              </span>
            )}
          </span>
        </span>
      </RadioGroupItem>

      {creditEligible ? (
        <RadioGroupItem value="credit_line">
          <span className="flex items-start gap-2">
            <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-steel" aria-hidden="true" />
            <span>
              <span className="block font-medium text-ink">{t('checkout.payment.credit.title')}</span>
              <span className="block text-sm text-steel">
                {t('checkout.payment.credit.description', {
                  available: creditAvailablePaise !== undefined ? formatINR(creditAvailablePaise) : '',
                })}
              </span>
            </span>
          </span>
        </RadioGroupItem>
      ) : null}
    </RadioGroup>
  )
}
