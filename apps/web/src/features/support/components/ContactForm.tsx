import type { SupportTicketCategory } from '@snapspare/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuth } from '@/features/auth/api/AuthProvider'
import { createSupportTicket } from '@/features/support/api/supportTicketActions'

const CATEGORIES: SupportTicketCategory[] = [
  'order_issue',
  'payment_issue',
  'return_refund',
  'seller_conduct',
  'account_access',
  'listing_or_pricing',
  'other',
]

/**
 * Phase 24 (launch readiness): the contact form behind `/support`. Works
 * signed-out (a guest can file a ticket, e.g. "I can't log in" — see
 * createSupportTicket.ts's header comment) as well as signed-in, where it
 * prefills name/email/phone from the buyer's profile.
 */
export function ContactForm() {
  const { t } = useTranslation()
  const { user, profile } = useAuth()

  const [contactName, setContactName] = useState(profile?.displayName ?? '')
  const [contactEmail, setContactEmail] = useState(profile?.email ?? '')
  const [contactPhone, setContactPhone] = useState(profile?.phone ?? '')
  const [category, setCategory] = useState<SupportTicketCategory>('order_issue')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [submittedTicketId, setSubmittedTicketId] = useState<string | null>(null)

  const hasContactChannel = contactEmail.trim().length > 0 || contactPhone.trim().length > 0
  const canSubmit = contactName.trim().length > 0 && subject.trim().length > 0 && message.trim().length > 0 && hasContactChannel

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!canSubmit) return
    setBusy(true)
    try {
      const result = await createSupportTicket({
        contactName: contactName.trim(),
        contactEmail: contactEmail.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
        category,
        subject: subject.trim(),
        message: message.trim(),
      })
      setSubmittedTicketId(result.ticketId)
      setSubject('')
      setMessage('')
      toast.success(t('support.contactForm.success'))
    } catch {
      toast.error(t('support.contactForm.error'))
    } finally {
      setBusy(false)
    }
  }

  if (submittedTicketId) {
    return (
      <div role="status" className="rounded-[6px] border border-verify/30 bg-verify/5 p-4 text-sm text-ink">
        <p className="font-medium text-verify">{t('support.contactForm.submittedTitle')}</p>
        <p className="mt-1 text-steel">{t('support.contactForm.submittedDescription')}</p>
        {user ? (
          <a href="/account" className="mt-2 inline-block font-medium text-signal hover:underline">
            {t('support.contactForm.viewTickets')}
          </a>
        ) : null}
        <button
          type="button"
          className="mt-3 block text-sm font-medium text-signal hover:underline"
          onClick={() => setSubmittedTicketId(null)}
        >
          {t('support.contactForm.submitAnother')}
        </button>
      </div>
    )
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="contact-name">{t('support.contactForm.nameLabel')}</Label>
          <Input id="contact-name" required value={contactName} onChange={(e) => setContactName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contact-category">{t('support.contactForm.categoryLabel')}</Label>
          <Select value={category} onValueChange={(value) => setCategory(value as SupportTicketCategory)}>
            <SelectTrigger id="contact-category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((option) => (
                <SelectItem key={option} value={option}>
                  {t(`support.category.${option}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="contact-email">{t('support.contactForm.emailLabel')}</Label>
          <Input id="contact-email" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contact-phone">{t('support.contactForm.phoneLabel')}</Label>
          <Input id="contact-phone" type="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
        </div>
      </div>
      {!hasContactChannel ? <p className="text-xs text-steel">{t('support.contactForm.contactChannelHint')}</p> : null}

      <div className="space-y-1.5">
        <Label htmlFor="contact-subject">{t('support.contactForm.subjectLabel')}</Label>
        <Input id="contact-subject" required value={subject} onChange={(e) => setSubject(e.target.value)} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="contact-message">{t('support.contactForm.messageLabel')}</Label>
        <textarea
          id="contact-message"
          required
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="flex w-full rounded-[6px] border border-steel/30 bg-surface px-3 py-2 text-base text-ink placeholder:text-steel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      <Button type="submit" variant="cta" disabled={!canSubmit || busy}>
        {busy ? t('common.loading') : t('support.contactForm.submit')}
      </Button>
    </form>
  )
}
