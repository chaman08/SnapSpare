import type { CouponApplicationResult } from '@snapspare/shared'
import { formatINR } from '@snapspare/shared'
import { Tag, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

function rejectionI18nKey(reason: Extract<CouponApplicationResult, { status: 'rejected' }>['reason']): string {
  switch (reason) {
    case 'not_found':
      return 'cart.coupon.errors.notFound'
    case 'inactive':
      return 'cart.coupon.errors.inactive'
    case 'expired':
      return 'cart.coupon.errors.expired'
    case 'not_yet_valid':
      return 'cart.coupon.errors.notYetValid'
    case 'min_order_not_met':
      return 'cart.coupon.errors.minOrderNotMet'
    case 'not_applicable_to_cart':
      return 'cart.coupon.errors.notApplicable'
    case 'usage_limit_reached':
      return 'cart.coupon.errors.usageLimitReached'
    default:
      return 'cart.coupon.errors.generic'
  }
}

interface CouponInputProps {
  coupon: CouponApplicationResult | undefined
  onApply: (code: string) => void
  onRemove: () => void
  pending?: boolean
}

/** Coupon input with server validation and a readable failure reason (design spec item 7) — the code itself is never validated client-side; every outcome comes back from priceCart. */
export function CouponInput({ coupon, onApply, onRemove, pending }: CouponInputProps) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState('')

  if (coupon?.status === 'applied') {
    return (
      <div className="flex items-center justify-between gap-2 rounded-[6px] border border-verify/30 bg-verify/5 px-3 py-2">
        <span className="inline-flex items-center gap-1.5 text-sm text-verify">
          <Tag className="h-3.5 w-3.5" aria-hidden="true" />
          {t('cart.coupon.applied', { code: coupon.code, amount: formatINR(coupon.discountPaise) })}
        </span>
        <button
          type="button"
          onClick={onRemove}
          disabled={pending}
          aria-label={t('cart.coupon.remove')}
          className="flex min-h-tap min-w-tap items-center justify-center text-verify hover:opacity-70 disabled:opacity-50"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          if (draft.trim()) onApply(draft.trim().toUpperCase())
        }}
      >
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={t('cart.coupon.placeholder')}
          aria-label={t('cart.coupon.label')}
          className="flex-1"
        />
        <Button type="submit" variant="outline" size="default" disabled={pending || !draft.trim()}>
          {t('cart.coupon.apply')}
        </Button>
      </form>
      {coupon?.status === 'rejected' ? (
        <p role="alert" className="text-xs text-alert">
          {t(rejectionI18nKey(coupon.reason), {
            amount: coupon.minOrderValuePaise !== undefined ? formatINR(coupon.minOrderValuePaise) : undefined,
          })}
        </p>
      ) : null}
    </div>
  )
}
