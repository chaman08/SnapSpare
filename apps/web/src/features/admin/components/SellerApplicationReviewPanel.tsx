import type { SellerApplication, SellerApplicationReviewNote } from '@snapspare/shared'
import { AlertTriangle, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { reviewSellerApplication } from '@/features/admin/api/sellerApplicationActions'

interface SellerApplicationReviewPanelProps {
  application: SellerApplication
}

const REVIEW_STEPS: SellerApplicationReviewNote['step'][] = [
  'business',
  'tax_identity',
  'addresses',
  'bank',
  'documents',
  'agreement',
  'general',
]

function Field({ label, value }: { label: string; value?: string | number | boolean | null }) {
  if (value === undefined || value === null || value === '') return null
  return (
    <div>
      <dt className="text-xs text-steel">{label}</dt>
      <dd className="text-sm text-ink">{String(value)}</dd>
    </div>
  )
}

export function SellerApplicationReviewPanel({ application }: SellerApplicationReviewPanelProps) {
  const { t } = useTranslation()
  const [notes, setNotes] = useState<{ step: SellerApplicationReviewNote['step']; message: string }[]>([])
  const [busy, setBusy] = useState(false)
  const canApprove = Boolean(application.taxIdentity?.gstin)

  function addNote() {
    setNotes((n) => [...n, { step: 'general', message: '' }])
  }
  function updateNote(index: number, patch: Partial<{ step: SellerApplicationReviewNote['step']; message: string }>) {
    setNotes((n) => n.map((note, i) => (i === index ? { ...note, ...patch } : note)))
  }
  function removeNote(index: number) {
    setNotes((n) => n.filter((_, i) => i !== index))
  }

  async function runAction(action: 'start_review' | 'request_changes' | 'approve' | 'reject') {
    setBusy(true)
    try {
      await reviewSellerApplication({
        applicationId: application.id,
        action,
        notes: action === 'request_changes' ? notes.filter((n) => n.message.trim()) : undefined,
        reason: action === 'reject' ? notes.map((n) => n.message).join('; ') || undefined : undefined,
      })
      toast.success(t(`admin.sellerApplications.action.${action}Success`))
      setNotes([])
    } catch {
      toast.error(t('admin.sellerApplications.actionFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-3 rounded-[6px] border border-steel/20 p-4 sm:grid-cols-3">
        <Field label={t('sell.wizard.business.legalName')} value={application.business?.legalName} />
        <Field label={t('sell.wizard.business.tradeName')} value={application.business?.tradeName} />
        <Field label={t('sell.wizard.business.businessType')} value={application.business?.businessType} />
        <Field label={t('sell.wizard.business.yearsInBusiness')} value={application.business?.yearsInBusiness} />
        <Field label={t('sell.wizard.tax.gstin')} value={application.taxIdentity?.gstin} />
        <Field label={t('sell.wizard.tax.pan')} value={application.taxIdentity?.pan} />
        <Field label={t('sell.wizard.business.categories')} value={application.business?.categorySlugs.join(', ')} />
        <Field label={t('sell.wizard.bank.bankName')} value={application.bank?.bankName} />
        <Field label={t('sell.wizard.bank.ifsc')} value={application.bank?.ifsc} />
      </section>

      <section className="rounded-[6px] border border-steel/20 p-4">
        <h3 className="mb-2 font-heading text-base font-semibold text-ink">{t('sell.wizard.addresses.pickupTitle')}</h3>
        <ul className="space-y-1 text-sm text-ink">
          {application.pickupAddresses.map((addr) => (
            <li key={addr.id}>
              {addr.label}: {addr.line1}, {addr.city}, {addr.state} - {addr.pincode}
              {addr.isDefault ? ` (${t('sell.wizard.addresses.setDefault')})` : ''}
            </li>
          ))}
        </ul>
      </section>

      {!canApprove ? (
        <p className="inline-flex items-start gap-2 rounded-[6px] border border-alert/30 bg-alert/5 p-3 text-sm text-ink">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-alert" aria-hidden="true" />
          {t('admin.sellerApplications.gstinRequiredToApprove')}
        </p>
      ) : null}

      <section className="space-y-2 rounded-[6px] border border-steel/20 p-4">
        <h3 className="font-heading text-base font-semibold text-ink">{t('admin.sellerApplications.notesTitle')}</h3>
        {notes.map((note, index) => (
          <div key={index} className="flex flex-wrap items-center gap-2">
            <select
              value={note.step}
              onChange={(e) => updateNote(index, { step: e.target.value as SellerApplicationReviewNote['step'] })}
              className="h-9 rounded-[6px] border border-steel/30 bg-surface px-2 text-sm"
            >
              {REVIEW_STEPS.map((step) => (
                <option key={step} value={step}>
                  {t(`sell.wizard.steps.${step === 'tax_identity' ? 'taxIdentity' : step}`, { defaultValue: step })}
                </option>
              ))}
            </select>
            <Input
              className="flex-1"
              placeholder={t('admin.sellerApplications.notePlaceholder')}
              value={note.message}
              onChange={(e) => updateNote(index, { message: e.target.value })}
            />
            <Button type="button" variant="ghost" size="icon" onClick={() => removeNote(index)} aria-label={t('sellerStaff.list.remove')}>
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addNote}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t('admin.sellerApplications.addNote')}
        </Button>
      </section>

      <div className="flex flex-wrap gap-2">
        {application.status === 'submitted' ? (
          <Button type="button" variant="outline" disabled={busy} onClick={() => runAction('start_review')}>
            {t('admin.sellerApplications.action.startReview')}
          </Button>
        ) : null}
        <Button type="button" variant="outline" disabled={busy || notes.length === 0} onClick={() => runAction('request_changes')}>
          {t('admin.sellerApplications.action.requestChanges')}
        </Button>
        <Button type="button" variant="destructive" disabled={busy} onClick={() => runAction('reject')}>
          {t('admin.sellerApplications.action.reject')}
        </Button>
        <Button type="button" variant="cta" disabled={busy || !canApprove} onClick={() => runAction('approve')}>
          {t('admin.sellerApplications.action.approve')}
        </Button>
      </div>
    </div>
  )
}
