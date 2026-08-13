import { TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'

const DEFAULT_LOW_STOCK_THRESHOLD = 5

interface LowStockBadgeProps {
  stockQty: number
  reservedStock: number
  lowStockThresholdQty?: number
}

/** Client-side comparison against already-fetched listing data (My Listings) — no extra query. checkLowStockAndNotify.ts is the proactive push/WhatsApp side of the same threshold; this is just the in-app glance. */
export function LowStockBadge({ stockQty, reservedStock, lowStockThresholdQty }: LowStockBadgeProps) {
  const { t } = useTranslation()
  const available = stockQty - reservedStock
  const threshold = lowStockThresholdQty ?? DEFAULT_LOW_STOCK_THRESHOLD
  if (available > threshold) return null

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-alert/10 px-2 py-0.5 text-xs font-medium text-alert">
      <TriangleAlert className="h-3 w-3" aria-hidden="true" />
      {available === 0 ? t('sellerListings.inventory.outOfStock') : t('sellerListings.inventory.lowStock')}
    </span>
  )
}
