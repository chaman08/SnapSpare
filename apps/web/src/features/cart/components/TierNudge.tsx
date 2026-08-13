import type { TierNudge as TierNudgeData } from '@snapspare/shared'
import { formatINR } from '@snapspare/shared'
import { useTranslation } from 'react-i18next'

interface TierNudgeProps {
  nudge: TierNudgeData
  onApply: (qty: number) => void
}

/** "Add 2 more → ₹1,040/unit, save ₹240" one-tap nudge (design spec item 4) — bumps the line straight to the next cheaper tier's minQty. */
export function TierNudge({ nudge, onApply }: TierNudgeProps) {
  const { t } = useTranslation()

  return (
    <button
      type="button"
      onClick={() => onApply(nudge.nextTierMinQty)}
      className="inline-flex min-h-tap items-center gap-1 rounded-[6px] border border-dashed border-signal/50 bg-signal/5 px-2.5 py-1.5 text-left text-xs text-ink transition-colors hover:bg-signal/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
    >
      <span>
        {t('cart.tierNudge.line', {
          count: nudge.qtyToNextTier,
          price: formatINR(nudge.nextTierUnitPricePaise),
        })}
      </span>
      <span className="font-semibold text-verify">
        {t('cart.tierNudge.savings', { amount: formatINR(nudge.estimatedSavingsPaise) })}
      </span>
    </button>
  )
}
