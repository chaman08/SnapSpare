import type { RfqQuote } from '@snapspare/shared'
import { findContactInfo } from '@snapspare/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/api/AuthProvider'
import { mapRfqErrorToI18nKey, sendRfqMessage } from '@/features/rfq/api/rfqActions'
import { useRfqMessages } from '@/features/rfq/api/useRfqMessages'
import { cn } from '@/lib/utils'

interface RfqMessageThreadProps {
  quote: RfqQuote
  /** Admin's read-only view — sendRfqMessage.ts only accepts the rfq's buyer or the quote's seller as a sender, so the composer is pointless (and would 403) for anyone else. */
  readOnly?: boolean
}

/**
 * Requirement 5: a private thread per (rfq, seller) quote. The composer runs
 * the same `findContactInfo` heuristic the server uses (packages/shared's
 * validators/messageContent.ts) for instant feedback, but the server call is
 * still the authoritative check — a client-side bypass can never actually
 * post a blocked message, only skip the early warning.
 */
export function RfqMessageThread({ quote, readOnly }: RfqMessageThreadProps) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { messages, loading } = useRfqMessages(quote.id)
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)

  const contactInfoWarning = findContactInfo(body)

  async function handleSend() {
    const trimmed = body.trim()
    if (!trimmed) return
    setSending(true)
    try {
      await sendRfqMessage({ quoteId: quote.id, body: trimmed, attachments: [] })
      setBody('')
    } catch (error) {
      toast.error(t(mapRfqErrorToI18nKey(error)))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-steel">{t('rfq.thread.moderationNotice')}</p>

      <div className="max-h-64 space-y-2 overflow-y-auto rounded-[6px] border border-steel/20 p-3">
        {loading ? (
          <p className="text-sm text-steel">{t('common.loading')}</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-steel">{t('rfq.thread.empty')}</p>
        ) : (
          messages.map((message) => {
            const isOwn = message.senderId === user?.uid
            return (
              <div key={message.id} className={cn('flex', isOwn ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'max-w-[80%] rounded-[6px] px-3 py-2 text-sm',
                    isOwn ? 'bg-signal/10 text-ink' : 'bg-surface-muted text-ink',
                  )}
                >
                  <p>{message.body}</p>
                  <p className="mt-1 text-xs text-steel">{new Date(message.createdAt).toLocaleString()}</p>
                </div>
              </div>
            )
          })
        )}
      </div>

      {readOnly ? null : (
        <div className="space-y-1.5">
          <textarea
            rows={2}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder={t('rfq.thread.placeholder')}
            className="flex w-full rounded-[6px] border border-steel/30 bg-surface p-3 text-base text-ink placeholder:text-steel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
          />
          {contactInfoWarning ? (
            <p role="alert" className="text-sm text-alert">
              {t(`rfq.thread.contactInfoWarning.${contactInfoWarning}`)}
            </p>
          ) : null}
          <Button type="button" variant="cta" size="sm" onClick={handleSend} disabled={sending || !body.trim() || Boolean(contactInfoWarning)}>
            {sending ? t('common.loading') : t('rfq.thread.send')}
          </Button>
        </div>
      )}
    </div>
  )
}
