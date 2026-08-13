import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { mapSubOrderActionErrorToI18nKey, shipSubOrder } from '@/features/orders/api/subOrderActions'

interface ShipSubOrderFormProps {
  subOrderId: string
  onShipped: () => void
  onCancel: () => void
}

/** Inline AWB/courier entry shown when a seller clicks "Ship" on a packed subOrder — no Shiprocket booking call in this phase, so the seller enters the AWB from whatever courier handoff they already did. */
export function ShipSubOrderForm({ subOrderId, onShipped, onCancel }: ShipSubOrderFormProps) {
  const { t } = useTranslation()
  const [awb, setAwb] = useState('')
  const [courier, setCourier] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    if (!awb.trim() || !courier.trim()) return
    setSubmitting(true)
    try {
      await shipSubOrder({ subOrderId, awb: awb.trim(), courier: courier.trim() })
      toast.success(t('sellerOrders.ship.success'))
      onShipped()
    } catch (error) {
      toast.error(t(mapSubOrderActionErrorToI18nKey(error)))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-[6px] border border-steel/20 bg-surface-muted p-3">
      <div className="space-y-1">
        <label htmlFor={`awb-${subOrderId}`} className="text-xs font-medium text-ink">
          {t('sellerOrders.ship.awbLabel')}
        </label>
        <input
          id={`awb-${subOrderId}`}
          value={awb}
          onChange={(event) => setAwb(event.target.value)}
          className="min-h-tap w-40 rounded-[6px] border border-steel/30 bg-surface px-2 font-mono text-sm text-ink"
        />
      </div>
      <div className="space-y-1">
        <label htmlFor={`courier-${subOrderId}`} className="text-xs font-medium text-ink">
          {t('sellerOrders.ship.courierLabel')}
        </label>
        <input
          id={`courier-${subOrderId}`}
          value={courier}
          onChange={(event) => setCourier(event.target.value)}
          className="min-h-tap w-40 rounded-[6px] border border-steel/30 bg-surface px-2 text-sm text-ink"
        />
      </div>
      <Button
        type="button"
        variant="cta"
        size="sm"
        onClick={handleSubmit}
        disabled={submitting || !awb.trim() || !courier.trim()}
      >
        {submitting ? t('common.loading') : t('sellerOrders.ship.confirm')}
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={submitting}>
        {t('common.back')}
      </Button>
    </div>
  )
}
