import { useTranslation } from 'react-i18next'

interface ReservedAvailableBreakdownProps {
  stockQty: number
  reservedStock: number
}

/** stockQty − reservedStock = available-to-sell — both fields already live on the listing doc, no extra query needed. Reserved units are holds against pending_payment orders (see stockOps.ts), not a separate ledger concept. */
export function ReservedAvailableBreakdown({ stockQty, reservedStock }: ReservedAvailableBreakdownProps) {
  const { t } = useTranslation()
  const available = stockQty - reservedStock

  return (
    <div className="grid grid-cols-3 gap-3 rounded-[6px] border border-steel/20 p-3 text-center">
      <div>
        <p className="font-mono text-lg font-semibold text-ink">{stockQty}</p>
        <p className="text-xs text-steel">{t('sellerListings.inventory.totalStock')}</p>
      </div>
      <div>
        <p className="font-mono text-lg font-semibold text-ink">{reservedStock}</p>
        <p className="text-xs text-steel">{t('sellerListings.inventory.reserved')}</p>
      </div>
      <div>
        <p className="font-mono text-lg font-semibold text-verify">{available}</p>
        <p className="text-xs text-steel">{t('sellerListings.inventory.available')}</p>
      </div>
    </div>
  )
}
