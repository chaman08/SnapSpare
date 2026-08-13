import type { Dispute, DisputeResolutionAction } from '@snapspare/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { resolveDispute } from '@/features/admin/api/disputeActions'

const ACTIONS: DisputeResolutionAction[] = ['refund_buyer', 'partial_refund', 'uphold_seller', 'dismissed']

interface DisputePanelProps {
  dispute: Dispute
}

/**
 * Admin forced-resolution UI (design brief item 7): a full evidence
 * timeline, an SLA countdown, and a resolution action that can refund the
 * buyer and debit the seller ledger — the note is mandatory both here
 * (client-side) and server-side (resolveDisputeRequestSchema's `.min(1)`).
 */
export function DisputePanel({ dispute }: DisputePanelProps) {
  const { t } = useTranslation()
  const [action, setAction] = useState<DisputeResolutionAction>('refund_buyer')
  const [refundAmountPaise, setRefundAmountPaise] = useState('')
  const [adminNote, setAdminNote] = useState('')
  const [busy, setBusy] = useState(false)

  const hoursLeft = Math.max(0, Math.round((dispute.slaBreachAt - Date.now()) / (60 * 60_000)))
  const needsAmount = action === 'refund_buyer' || action === 'partial_refund'

  async function handleResolve() {
    if (adminNote.trim().length === 0) return
    if (needsAmount && !refundAmountPaise) return
    setBusy(true)
    try {
      await resolveDispute({
        disputeId: dispute.id,
        action,
        refundAmountPaise: needsAmount ? Number(refundAmountPaise) : undefined,
        adminNote: adminNote.trim(),
      })
      toast.success(t('admin.disputes.resolveSuccess'))
    } catch {
      toast.error(t('admin.disputes.actionFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-3 rounded-[6px] border border-steel/20 p-4 sm:grid-cols-3">
        <div>
          <dt className="text-xs text-steel">{t('admin.disputes.typeLabel')}</dt>
          <dd className="text-sm text-ink">{dispute.type}</dd>
        </div>
        <div>
          <dt className="text-xs text-steel">{t('admin.disputes.statusLabel')}</dt>
          <dd className="text-sm text-ink">{t(`admin.disputes.status.${dispute.status}`)}</dd>
        </div>
        <div>
          <dt className="text-xs text-steel">{t('admin.disputes.slaLabel')}</dt>
          <dd className={hoursLeft <= 6 ? 'text-sm font-medium text-alert' : 'text-sm text-ink'}>
            {hoursLeft}h
          </dd>
        </div>
      </section>

      <section className="rounded-[6px] border border-steel/20 p-4">
        <h3 className="mb-1 font-heading text-base font-semibold text-ink">{t('admin.disputes.reasonTitle')}</h3>
        <p className="whitespace-pre-wrap text-sm text-ink">{dispute.reasonNotes}</p>
      </section>

      {dispute.evidence.length > 0 ? (
        <section className="rounded-[6px] border border-steel/20 p-4">
          <h3 className="mb-2 font-heading text-base font-semibold text-ink">{t('admin.disputes.evidenceTitle')}</h3>
          <ul className="space-y-1 text-xs text-steel">
            {dispute.evidence.map((entry, index) => (
              <li key={`${entry.url}-${index}`} className="font-mono">
                {entry.uploadedBy} — {new Date(entry.uploadedAt).toLocaleString()}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {dispute.status !== 'resolved' ? (
        <section className="space-y-3 rounded-[6px] border border-steel/20 p-4">
          <h3 className="font-heading text-base font-semibold text-ink">{t('admin.disputes.actionLabel')}</h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {ACTIONS.map((option) => (
              <label key={option} className="flex items-center gap-2 rounded-[6px] border border-steel/20 p-2 text-sm">
                <input type="radio" name="disputeAction" checked={action === option} onChange={() => setAction(option)} />
                {t(`admin.disputes.action.${option}`)}
              </label>
            ))}
          </div>
          {needsAmount ? (
            <div className="space-y-1.5">
              <Label htmlFor="refund-amount">{t('admin.disputes.refundAmountLabel')}</Label>
              <Input
                id="refund-amount"
                type="number"
                min={0}
                value={refundAmountPaise}
                onChange={(e) => setRefundAmountPaise(e.target.value)}
              />
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="admin-note">{t('admin.disputes.adminNoteLabel')}</Label>
            <Input id="admin-note" value={adminNote} onChange={(e) => setAdminNote(e.target.value)} />
          </div>
          <Button
            type="button"
            variant="destructive"
            disabled={busy || adminNote.trim().length === 0 || (needsAmount && !refundAmountPaise)}
            onClick={handleResolve}
          >
            {t('admin.disputes.resolve')}
          </Button>
        </section>
      ) : (
        <section className="rounded-[6px] border border-verify/30 bg-verify/5 p-4">
          <p className="text-sm text-verify">{dispute.resolution?.adminNote}</p>
        </section>
      )}
    </div>
  )
}
