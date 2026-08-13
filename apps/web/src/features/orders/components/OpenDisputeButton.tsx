import type { DisputeType } from '@snapspare/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { mapDisputeErrorToI18nKey, openDispute } from '@/features/orders/api/disputeActions'

interface OpenDisputeButtonProps {
  type: DisputeType
  orderId: string
  subOrderId: string
  returnId?: string
  warrantyClaimId?: string
}

/** Escalates a QC disagreement or a rejected/brand-escalated warranty claim to admin (design brief item 7) — buyer or seller, whichever side didn't already act. */
export function OpenDisputeButton({ type, orderId, subOrderId, returnId, warrantyClaimId }: OpenDisputeButtonProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [reasonNotes, setReasonNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [opened, setOpened] = useState(false)

  async function handleSubmit() {
    if (reasonNotes.trim().length === 0) return
    setSubmitting(true)
    try {
      await openDispute({ type, orderId, subOrderId, returnId, warrantyClaimId, reasonNotes: reasonNotes.trim() })
      toast.success(t('orders.dispute.success'))
      setOpened(true)
      setOpen(false)
    } catch (error) {
      toast.error(t(mapDisputeErrorToI18nKey(error)))
    } finally {
      setSubmitting(false)
    }
  }

  if (opened) {
    return <p className="text-sm text-steel">{t('orders.dispute.pendingReview')}</p>
  }

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        {t('orders.dispute.action')}
      </Button>
    )
  }

  return (
    <div className="space-y-2 rounded-[6px] border border-steel/20 p-3">
      <label htmlFor="dispute-reason" className="text-sm font-medium text-ink">
        {t('orders.dispute.reasonLabel')}
      </label>
      <textarea
        id="dispute-reason"
        value={reasonNotes}
        onChange={(event) => setReasonNotes(event.target.value)}
        rows={3}
        className="w-full rounded-[6px] border border-steel/30 bg-surface p-2 text-sm text-ink"
      />
      <div className="flex gap-2">
        <Button type="button" variant="destructive" size="sm" disabled={submitting || reasonNotes.trim().length === 0} onClick={handleSubmit}>
          {submitting ? t('common.loading') : t('orders.dispute.submit')}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={submitting}>
          {t('common.back')}
        </Button>
      </div>
    </div>
  )
}
