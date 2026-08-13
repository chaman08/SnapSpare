import { Minus, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

interface QuantityStepperProps {
  qty: number
  min: number
  max?: number
  /** Quantity increment above `min` a buyer must stick to (e.g. 10 when sold "by the box"). Defaults to 1. */
  stepQty?: number
  /** Human-readable pack description shown under the stepper, e.g. "1 box = 10 pcs". */
  packLabel?: string
  onChange: (qty: number) => void
  className?: string
}

/** The nearest valid quantity to `raw`: on the min/stepQty grid, clamped to [min, max]. */
function snapToValidQty(raw: number, min: number, max: number | undefined, stepQty: number): number {
  if (!Number.isFinite(raw)) return min
  const clamped = Math.min(Math.max(raw, min), max ?? Number.POSITIVE_INFINITY)
  const stepsAbove = Math.round((clamped - min) / stepQty)
  let snapped = min + stepsAbove * stepQty
  if (max !== undefined && snapped > max) snapped -= stepQty
  return Math.max(min, snapped)
}

/**
 * Inline +/- quantity control used on ProductCard, cart lines and the PDP
 * buy box. +/- always move by `stepQty` and never go below `min` (the
 * listing's MOQ). Direct numeric entry snaps to the nearest valid quantity
 * on blur/Enter — rather than silently correcting, it says why (see
 * `snapMessage`), announced via aria-live so it isn't a silent surprise.
 */
export function QuantityStepper({
  qty,
  min,
  max,
  stepQty = 1,
  packLabel,
  onChange,
  className,
}: QuantityStepperProps) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState(String(qty))
  const [snapMessage, setSnapMessage] = useState<string | null>(null)
  const canDecrement = qty > min
  const canIncrement = max === undefined || qty < max

  useEffect(() => {
    setDraft(String(qty))
  }, [qty])

  function commitDraft() {
    const raw = Number(draft)
    const snapped = snapToValidQty(raw, min, max, stepQty)
    setDraft(String(snapped))
    if (snapped !== raw) {
      setSnapMessage(t('product.quantitySnapped', { qty: snapped }))
    } else {
      setSnapMessage(null)
    }
    if (snapped !== qty) onChange(snapped)
  }

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="inline-flex items-center rounded-[6px] border border-steel/30">
        <button
          type="button"
          disabled={!canDecrement}
          onClick={() => onChange(Math.max(min, qty - stepQty))}
          aria-label={t('product.quantityDecrease')}
          className="flex min-h-tap min-w-tap items-center justify-center text-ink disabled:opacity-30"
        >
          <Minus className="h-4 w-4" aria-hidden="true" />
        </button>
        <input
          type="text"
          inputMode="numeric"
          aria-label={t('product.quantityInput')}
          value={draft}
          onChange={(event) => setDraft(event.target.value.replace(/[^0-9]/g, ''))}
          onBlur={commitDraft}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              commitDraft()
            }
          }}
          className="min-w-[3ch] max-w-[6ch] border-0 bg-transparent px-1 text-center font-mono text-sm tabular-nums text-ink focus-visible:outline-none"
        />
        <button
          type="button"
          disabled={!canIncrement}
          onClick={() => onChange(canIncrement ? Math.min(qty + stepQty, max ?? qty + stepQty) : qty)}
          aria-label={t('product.quantityIncrease')}
          className="flex min-h-tap min-w-tap items-center justify-center text-ink disabled:opacity-30"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {packLabel ? <p className="text-xs text-steel">{packLabel}</p> : null}
      <p aria-live="polite" className="text-xs text-signal empty:hidden">
        {snapMessage}
      </p>
    </div>
  )
}
