import type { GstRatePercent, PartRequest } from '@snapspare/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { reviewPartRequest } from '@/features/admin/api/partRequestActions'

const GST_RATES: GstRatePercent[] = [0, 5, 12, 18, 28]

function Field({ label, value }: { label: string; value?: string | number | null }) {
  if (value === undefined || value === null || value === '') return null
  return (
    <div>
      <dt className="text-xs text-steel">{label}</dt>
      <dd className="text-sm text-ink">{String(value)}</dd>
    </div>
  )
}

interface PartRequestReviewPanelProps {
  request: PartRequest
}

export function PartRequestReviewPanel({ request }: PartRequestReviewPanelProps) {
  const { t } = useTranslation()
  const [message, setMessage] = useState('')
  const [partNumber, setPartNumber] = useState('')
  const [hsnCode, setHsnCode] = useState(request.hsnCode ?? '')
  const [gstRatePercent, setGstRatePercent] = useState<GstRatePercent>(request.gstRatePercent ?? 28)
  const [busy, setBusy] = useState(false)

  const canApprove = partNumber.trim().length > 0 && hsnCode.trim().length > 0

  async function runAction(action: 'start_review' | 'request_changes' | 'reject' | 'approve') {
    setBusy(true)
    try {
      await reviewPartRequest({
        requestId: request.id,
        action,
        message: action === 'request_changes' || action === 'reject' ? message || undefined : undefined,
        approvedPartNumber: action === 'approve' ? partNumber.trim() : undefined,
        approvedHsnCode: action === 'approve' ? hsnCode.trim() : undefined,
        approvedGstRatePercent: action === 'approve' ? gstRatePercent : undefined,
      })
      toast.success(t(`admin.partRequests.action.${action}Success`))
      setMessage('')
    } catch {
      toast.error(t('admin.partRequests.actionFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-3 rounded-[6px] border border-steel/20 p-4 sm:grid-cols-3">
        <Field label={t('sellerListings.partRequest.titleLabel')} value={request.title} />
        <Field label={t('sellerListings.partRequest.brandLabel')} value={request.brand} />
        <Field label={t('sellerListings.partRequest.oemNumberLabel')} value={request.oemNumber} />
        <Field label={t('sellerListings.partRequest.partTypeLabel')} value={t(`sellerListings.partRequest.partType.${request.partType}`)} />
        <Field label={t('sellerListings.partRequest.categoryLabel')} value={request.categorySlug} />
        <Field label={t('sellerListings.partRequest.subcategoryLabel')} value={request.subcategorySlug} />
      </section>

      {request.description ? (
        <section className="rounded-[6px] border border-steel/20 p-4">
          <h3 className="mb-1 font-heading text-base font-semibold text-ink">{t('sellerListings.partRequest.specsLabel')}</h3>
          <p className="whitespace-pre-wrap text-sm text-ink">{request.description}</p>
        </section>
      ) : null}

      {request.fitmentNotes ? (
        <section className="rounded-[6px] border border-steel/20 p-4">
          <h3 className="mb-1 font-heading text-base font-semibold text-ink">{t('sellerListings.partRequest.fitmentLabel')}</h3>
          <p className="whitespace-pre-wrap text-sm text-ink">{request.fitmentNotes}</p>
        </section>
      ) : null}

      {request.images.length > 0 ? (
        <section className="flex flex-wrap gap-2">
          {request.images.map((url) => (
            <img key={url} src={url} alt="" className="h-20 w-20 rounded-[6px] object-cover" />
          ))}
        </section>
      ) : null}

      <section className="space-y-3 rounded-[6px] border border-steel/20 p-4">
        <h3 className="font-heading text-base font-semibold text-ink">{t('admin.partRequests.confirmCatalogueValues')}</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="approved-part-number">{t('admin.partRequests.approvedPartNumber')}</Label>
            <Input
              id="approved-part-number"
              className="font-mono"
              value={partNumber}
              onChange={(e) => setPartNumber(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="approved-hsn">{t('sellerListings.addFlow.hsnCodeLabel')}</Label>
            <Input id="approved-hsn" className="font-mono" value={hsnCode} onChange={(e) => setHsnCode(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="approved-gst">{t('sellerListings.addFlow.gstRateLabel')}</Label>
            <select
              id="approved-gst"
              value={gstRatePercent}
              onChange={(e) => setGstRatePercent(Number(e.target.value) as GstRatePercent)}
              className="flex min-h-tap w-full rounded-[6px] border border-steel/30 bg-surface px-3 text-base text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
            >
              {GST_RATES.map((rate) => (
                <option key={rate} value={rate}>
                  {rate}%
                </option>
              ))}
            </select>
          </div>
        </div>
        {!canApprove ? <p className="text-xs text-steel">{t('admin.partRequests.approveRequiresValues')}</p> : null}
      </section>

      <section className="space-y-2 rounded-[6px] border border-steel/20 p-4">
        <Label htmlFor="review-message">{t('admin.partRequests.notesTitle')}</Label>
        <Input id="review-message" value={message} onChange={(e) => setMessage(e.target.value)} placeholder={t('admin.sellerApplications.notePlaceholder')} />
      </section>

      <div className="flex flex-wrap gap-2">
        {request.status === 'pending' ? (
          <Button type="button" variant="outline" disabled={busy} onClick={() => runAction('start_review')}>
            {t('admin.sellerApplications.action.startReview')}
          </Button>
        ) : null}
        <Button type="button" variant="outline" disabled={busy || !message} onClick={() => runAction('request_changes')}>
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
