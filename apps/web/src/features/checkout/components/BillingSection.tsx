import type { BillingDetails } from '@snapspare/shared'
import { gstinSchema } from '@snapspare/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useAddresses } from '@/features/auth/api/addresses'
import { verifyGstin } from '@/features/auth/api/verifyGstin'
import { cn } from '@/lib/utils'

interface BillingSectionProps {
  userId: string
  value: BillingDetails
  onChange: (value: BillingDetails) => void
}

/**
 * Checkout section 2 (design spec): the "This is a business purchase" toggle
 * reveals GSTIN (format + checksum validated, optionally verified via the
 * verifyGstin stub), legal business name, and an optional billing address
 * that differs from shipping. Never touches what's payable — GST is always
 * computed server-side by priceCart/createOrder regardless of what's typed
 * here.
 */
export function BillingSection({ userId, value, onChange }: BillingSectionProps) {
  const { t } = useTranslation()
  const { addresses } = useAddresses(userId)
  const [gstinError, setGstinError] = useState<string | null>(null)
  const [verifyStatus, setVerifyStatus] = useState<'idle' | 'checking' | 'pending' | 'invalid'>('idle')
  const [differentAddress, setDifferentAddress] = useState(Boolean(value.billingAddressId))

  function handleGstinChange(raw: string) {
    setVerifyStatus('idle')
    const upper = raw.toUpperCase()
    const result = gstinSchema.safeParse(upper)
    setGstinError(upper.length > 0 && !result.success ? t('auth.profile.gstinInvalid') : null)
    onChange({ ...value, gstin: upper })
  }

  async function handleVerify() {
    if (!value.gstin) return
    setVerifyStatus('checking')
    try {
      const result = await verifyGstin(value.gstin)
      setVerifyStatus(result.status)
    } catch {
      setVerifyStatus('invalid')
    }
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        role="switch"
        aria-checked={value.isBusinessPurchase}
        onClick={() => onChange({ ...value, isBusinessPurchase: !value.isBusinessPurchase })}
        className="flex min-h-tap w-full items-center justify-between gap-3 rounded-[6px] border border-steel/20 px-3 py-3 text-left"
      >
        <span>
          <span className="block font-medium text-ink">{t('checkout.billing.toggleLabel')}</span>
          <span className="block text-sm text-steel">{t('checkout.billing.toggleExplainer')}</span>
        </span>
        <span
          aria-hidden="true"
          className={cn(
            'relative h-6 w-11 shrink-0 rounded-full transition-colors',
            value.isBusinessPurchase ? 'bg-signal' : 'bg-steel/30',
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 h-5 w-5 rounded-full bg-surface transition-transform',
              value.isBusinessPurchase ? 'translate-x-5' : 'translate-x-0.5',
            )}
          />
        </span>
      </button>

      {value.isBusinessPurchase ? (
        <div className="space-y-4 rounded-[6px] border border-steel/20 p-4">
          <div className="space-y-1.5">
            <Label htmlFor="billing-gstin">{t('auth.profile.gstin')}</Label>
            <div className="flex gap-2">
              <Input
                id="billing-gstin"
                className="font-mono uppercase"
                maxLength={15}
                value={value.gstin ?? ''}
                onChange={(event) => handleGstinChange(event.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleVerify}
                disabled={!value.gstin || verifyStatus === 'checking'}
              >
                {t('auth.profile.verify')}
              </Button>
            </div>
            {gstinError ? (
              <p role="alert" className="text-sm text-alert">
                {gstinError}
              </p>
            ) : null}
            {verifyStatus === 'pending' ? <p className="text-sm text-verify">{t('auth.profile.verifyPending')}</p> : null}
            {verifyStatus === 'invalid' ? (
              <p role="alert" className="text-sm text-alert">
                {t('auth.profile.verifyInvalid')}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="billing-legal-name">{t('checkout.billing.legalName')}</Label>
            <Input
              id="billing-legal-name"
              value={value.legalName ?? ''}
              onChange={(event) => onChange({ ...value, legalName: event.target.value })}
            />
          </div>

          <div className="space-y-2">
            <button
              type="button"
              className="text-sm font-medium text-ink underline underline-offset-2"
              onClick={() => {
                const next = !differentAddress
                setDifferentAddress(next)
                if (!next) onChange({ ...value, billingAddressId: undefined })
              }}
            >
              {differentAddress ? t('checkout.billing.useShippingAddress') : t('checkout.billing.useDifferentAddress')}
            </button>

            {differentAddress ? (
              <RadioGroup
                name="billingAddress"
                aria-label={t('checkout.billing.selectAddress')}
                value={value.billingAddressId ?? ''}
                onValueChange={(billingAddressId) => onChange({ ...value, billingAddressId })}
                className="space-y-2"
              >
                {addresses.map((address) => (
                  <RadioGroupItem key={address.id} value={address.id}>
                    <span className="block text-sm text-ink">
                      {address.label} — {address.line1}, {address.city} {address.pincode}
                    </span>
                  </RadioGroupItem>
                ))}
              </RadioGroup>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
