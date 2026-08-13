import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cancelSubOrder, mapSubOrderActionErrorToI18nKey } from '@/features/orders/api/subOrderActions'

interface CancelSubOrderActionProps {
  subOrderId: string
  onCancelled: () => void
}

/** Inline confirm-then-cancel action (design item 4: "cancel/return actions gated by status and window") — the caller only renders this when the subOrder's current status is actually cancellable. */
export function CancelSubOrderAction({ subOrderId, onCancelled }: CancelSubOrderActionProps) {
  const { t } = useTranslation()
  const [confirming, setConfirming] = useState(false)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleConfirm() {
    setSubmitting(true)
    try {
      await cancelSubOrder({ subOrderId, reason: reason.trim() || undefined })
      toast.success(t('orders.cancel.success'))
      setConfirming(false)
      onCancelled()
    } catch (error) {
      toast.error(t(mapSubOrderActionErrorToI18nKey(error)))
    } finally {
      setSubmitting(false)
    }
  }

  if (!confirming) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setConfirming(true)}>
        {t('orders.cancel.action')}
      </Button>
    )
  }

  return (
    <div className="space-y-2 rounded-[6px] border border-alert/30 bg-alert/5 p-3">
      <label htmlFor={`cancel-reason-${subOrderId}`} className="text-sm font-medium text-ink">
        {t('orders.cancel.reasonLabel')}
      </label>
      <textarea
        id={`cancel-reason-${subOrderId}`}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        rows={2}
        className="min-h-tap w-full rounded-[6px] border border-steel/30 bg-surface p-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
        placeholder={t('orders.cancel.reasonPlaceholder')}
      />
      <div className="flex gap-2">
        <Button type="button" variant="destructive" size="sm" onClick={handleConfirm} disabled={submitting}>
          {submitting ? t('common.loading') : t('orders.cancel.confirm')}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={submitting}>
          {t('common.back')}
        </Button>
      </div>
    </div>
  )
}
