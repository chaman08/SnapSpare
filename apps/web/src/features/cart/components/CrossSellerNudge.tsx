import type { CheaperElsewhere } from '@snapspare/shared'
import { formatINR } from '@snapspare/shared'
import { ArrowRightLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface CrossSellerNudgeProps {
  nudge: CheaperElsewhere
  onSwitch: () => void
}

/** "Seller B has this part cheaper at your quantity" (design spec item 5) — shown honestly even though it costs this seller the sale, because it builds trust and lifts AOV. */
export function CrossSellerNudge({ nudge, onSwitch }: CrossSellerNudgeProps) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-[6px] bg-verify/5 px-2.5 py-1.5 text-xs text-ink">
      <ArrowRightLeft className="h-3.5 w-3.5 shrink-0 text-verify" aria-hidden="true" />
      <span>
        {t('cart.crossSellerNudge.line', {
          seller: nudge.sellerName || t('product.detail.compare.unnamedSeller'),
          price: formatINR(nudge.unitPricePaise),
        })}
      </span>
      <button
        type="button"
        onClick={onSwitch}
        className="font-semibold text-verify underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
      >
        {t('cart.crossSellerNudge.switch')}
      </button>
    </div>
  )
}
