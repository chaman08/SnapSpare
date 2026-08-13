import type { SubOrder } from '@snapspare/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { bookShipment, generateShippingLabel, mapShippingErrorToI18nKey, schedulePickup } from '@/features/seller/api/shippingActions'

interface BookShipmentPanelProps {
  subOrder: SubOrder
}

function todayPlus(days: number): string {
  const date = new Date(Date.now() + days * 24 * 60 * 60_000)
  return date.toISOString().slice(0, 10)
}

/**
 * Courier booking / pickup scheduling / label download for an already-packed
 * subOrder (design brief item 5) — shown alongside ShipSubOrderForm in
 * SellerOrdersPage's "toShip" tab. Reads shipment state straight from the
 * live `subOrder` prop (SellerOrdersPage's useSellerSubOrders is a realtime
 * listener), so each action just fires its callable; the next render
 * reflects the result without a manual refetch.
 */
export function BookShipmentPanel({ subOrder }: BookShipmentPanelProps) {
  const { t } = useTranslation()
  const [pickupDate, setPickupDate] = useState(todayPlus(1))
  const [busy, setBusy] = useState<'book' | 'pickup' | 'label' | null>(null)

  const shipment = subOrder.shipment
  const isBooked = Boolean(shipment?.providerShipmentId)
  const isPickupScheduled = Boolean(shipment?.pickupScheduledAt)

  async function handleBook() {
    setBusy('book')
    try {
      await bookShipment(subOrder.id)
      toast.success(t('sellerOrders.shipping.bookSuccess'))
    } catch (error) {
      toast.error(t(mapShippingErrorToI18nKey(error)))
    } finally {
      setBusy(null)
    }
  }

  async function handleSchedulePickup() {
    setBusy('pickup')
    try {
      await schedulePickup({ subOrderId: subOrder.id, pickupDate })
      toast.success(t('sellerOrders.shipping.pickupSuccess'))
    } catch (error) {
      toast.error(t(mapShippingErrorToI18nKey(error)))
    } finally {
      setBusy(null)
    }
  }

  async function handleDownloadLabel() {
    setBusy('label')
    try {
      const result = await generateShippingLabel(subOrder.id)
      window.open(result.labelUrl, '_blank', 'noopener,noreferrer')
    } catch (error) {
      toast.error(t(mapShippingErrorToI18nKey(error)))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-[6px] border border-steel/20 bg-surface-muted p-3">
      {!isBooked ? (
        <Button type="button" variant="outline" size="sm" disabled={busy !== null} onClick={handleBook}>
          {busy === 'book' ? t('common.loading') : t('sellerOrders.shipping.bookAction')}
        </Button>
      ) : (
        <>
          {shipment?.awb ? (
            <span className="text-xs text-steel">
              {t('orders.awb')}: <span className="font-mono text-ink">{shipment.awb}</span>
            </span>
          ) : null}

          {!isPickupScheduled ? (
            <div className="flex items-center gap-2">
              <label htmlFor={`pickup-date-${subOrder.id}`} className="sr-only">
                {t('sellerOrders.shipping.pickupDateLabel')}
              </label>
              <input
                id={`pickup-date-${subOrder.id}`}
                type="date"
                min={todayPlus(0)}
                value={pickupDate}
                onChange={(event) => setPickupDate(event.target.value)}
                className="min-h-tap rounded-[6px] border border-steel/30 bg-surface px-2 text-sm text-ink"
              />
              <Button type="button" variant="outline" size="sm" disabled={busy !== null} onClick={handleSchedulePickup}>
                {busy === 'pickup' ? t('common.loading') : t('sellerOrders.shipping.pickupAction')}
              </Button>
            </div>
          ) : (
            <span className="text-xs text-verify">
              {t('sellerOrders.shipping.pickupScheduledOn', { date: shipment?.pickupDate })}
            </span>
          )}

          <Button type="button" variant="outline" size="sm" disabled={busy !== null} onClick={handleDownloadLabel}>
            {busy === 'label' ? t('common.loading') : t('sellerOrders.shipping.labelAction')}
          </Button>
        </>
      )}
    </div>
  )
}
