import type { SubOrder } from '@snapspare/shared'
import { AlertTriangle } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { mapShippingErrorToI18nKey, requestNdrReattempt } from '@/features/seller/api/shippingActions'

interface NdrBannerProps {
  subOrder: SubOrder
}

/**
 * Buyer-facing non-delivery notice (design brief item 7's "buyer contact
 * prompt") — shown on OrderDetailPage whenever the courier reported a
 * failed delivery attempt. `raised` offers a one-tap "request redelivery"
 * (requestNdrReattempt.ts); later states are read-only status copy.
 */
export function NdrBanner({ subOrder }: NdrBannerProps) {
  const { t } = useTranslation()
  const [submitting, setSubmitting] = useState(false)
  const ndr = subOrder.shipment?.ndr
  if (!ndr) return null

  async function handleRequestReattempt() {
    setSubmitting(true)
    try {
      await requestNdrReattempt({ subOrderId: subOrder.id })
      toast.success(t('orders.ndr.reattemptRequested'))
    } catch (error) {
      toast.error(t(mapShippingErrorToI18nKey(error)))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-[6px] border border-alert/30 bg-alert/5 p-4">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-alert" aria-hidden="true" />
        <div>
          <p className="text-sm font-medium text-alert">{t(`orders.ndr.status.${ndr.status}`)}</p>
          <p className="text-xs text-alert/80">{t('orders.ndr.description')}</p>
        </div>
      </div>
      {ndr.status === 'raised' ? (
        <Button type="button" variant="cta" size="sm" disabled={submitting} onClick={handleRequestReattempt}>
          {submitting ? t('common.loading') : t('orders.ndr.requestRedelivery')}
        </Button>
      ) : null}
    </div>
  )
}
