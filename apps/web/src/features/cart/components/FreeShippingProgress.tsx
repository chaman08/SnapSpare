import { formatINR } from '@snapspare/shared'
import { useTranslation } from 'react-i18next'

interface FreeShippingProgressProps {
  taxableValuePaise: number
  thresholdPaise: number
  remainingPaise: number
}

/** Free-shipping progress bar (design spec item 6) — one per seller group, since shipping is computed per seller. Renders nothing once the threshold is met (the seller group's shippingPaise is already 0 by then; see the "free" line CartSellerGroupSection shows instead). */
export function FreeShippingProgress({ taxableValuePaise, thresholdPaise, remainingPaise }: FreeShippingProgressProps) {
  const { t } = useTranslation()
  if (remainingPaise <= 0 || thresholdPaise <= 0) return null

  const percent = Math.min(100, Math.max(0, (taxableValuePaise / thresholdPaise) * 100))

  return (
    <div className="space-y-1">
      <p className="text-xs text-steel">
        {t('cart.freeShipping.remaining', { amount: formatINR(remainingPaise) })}
      </p>
      <div
        role="progressbar"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t('cart.freeShipping.progressLabel')}
        className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted"
      >
        <div className="h-full rounded-full bg-verify transition-[width]" style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}
