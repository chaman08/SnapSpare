import type { SupportTicket } from '@snapspare/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { resolveSupportTicket, respondToSupportTicket } from '@/features/admin/api/supportTicketActions'

interface SupportTicketPanelProps {
  ticket: SupportTicket
}

/** Admin reply/resolve UI (Phase 24) — mirrors DisputePanel's shape: a status/SLA header, the message timeline, and the action area, swapped out once the ticket is resolved/closed. */
export function SupportTicketPanel({ ticket }: SupportTicketPanelProps) {
  const { t } = useTranslation()
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState(false)

  const hoursLeft = Math.max(0, Math.round((ticket.slaBreachAt - Date.now()) / (60 * 60_000)))
  const isOpen = ticket.status === 'open' || ticket.status === 'in_progress'

  async function handleReply() {
    if (reply.trim().length === 0) return
    setBusy(true)
    try {
      await respondToSupportTicket({ ticketId: ticket.id, body: reply.trim() })
      setReply('')
      toast.success(t('admin.support.replySuccess'))
    } catch {
      toast.error(t('admin.support.actionFailed'))
    } finally {
      setBusy(false)
    }
  }

  async function handleResolve(status: 'resolved' | 'closed') {
    setBusy(true)
    try {
      await resolveSupportTicket({ ticketId: ticket.id, status })
      toast.success(t('admin.support.resolveSuccess'))
    } catch {
      toast.error(t('admin.support.actionFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-3 rounded-[6px] border border-steel/20 p-4 sm:grid-cols-4">
        <div>
          <dt className="text-xs text-steel">{t('admin.support.categoryLabel')}</dt>
          <dd className="text-sm text-ink">{t(`support.category.${ticket.category}`)}</dd>
        </div>
        <div>
          <dt className="text-xs text-steel">{t('admin.support.statusLabel')}</dt>
          <dd className="text-sm text-ink">{t(`admin.support.status.${ticket.status}`)}</dd>
        </div>
        <div>
          <dt className="text-xs text-steel">{t('admin.support.slaLabel')}</dt>
          <dd className={hoursLeft <= 6 && isOpen ? 'text-sm font-medium text-alert' : 'text-sm text-ink'}>
            {isOpen ? `${hoursLeft}h` : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-steel">{t('admin.support.contactLabel')}</dt>
          <dd className="text-sm text-ink">
            {ticket.contactName}
            {ticket.contactEmail ? ` · ${ticket.contactEmail}` : ''}
            {ticket.contactPhone ? ` · ${ticket.contactPhone}` : ''}
          </dd>
        </div>
      </section>

      <section className="rounded-[6px] border border-steel/20 p-4">
        <h3 className="mb-1 font-heading text-base font-semibold text-ink">{ticket.subject}</h3>
        <ul className="mt-3 space-y-3">
          {ticket.messages.map((message, index) => (
            <li key={index} className="rounded-[6px] bg-surface-muted p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-steel">
                {t(`admin.support.authorRole.${message.authorRole}`)} · {new Date(message.createdAt).toLocaleString()}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{message.body}</p>
            </li>
          ))}
        </ul>
      </section>

      {isOpen ? (
        <section className="space-y-3 rounded-[6px] border border-steel/20 p-4">
          <h3 className="font-heading text-base font-semibold text-ink">{t('admin.support.replyTitle')}</h3>
          <textarea
            rows={4}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            className="flex w-full rounded-[6px] border border-steel/30 bg-surface px-3 py-2 text-base text-ink placeholder:text-steel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={busy || reply.trim().length === 0} onClick={handleReply}>
              {t('admin.support.sendReply')}
            </Button>
            <Button type="button" variant="outline" disabled={busy} onClick={() => handleResolve('resolved')}>
              {t('admin.support.markResolved')}
            </Button>
            <Button type="button" variant="outline" disabled={busy} onClick={() => handleResolve('closed')}>
              {t('admin.support.markClosed')}
            </Button>
          </div>
        </section>
      ) : (
        <section className="rounded-[6px] border border-verify/30 bg-verify/5 p-4">
          <p className="text-sm text-verify">{t(`admin.support.status.${ticket.status}`)}</p>
        </section>
      )}
    </div>
  )
}
