import type { ReturnReason, ReturnResolutionPreference, SubOrder } from '@snapspare/shared'
import { returnReasonSchema } from '@snapspare/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/api/AuthProvider'
import { mapSubOrderActionErrorToI18nKey, requestReturn } from '@/features/orders/api/subOrderActions'
import { uploadPostSaleEvidence } from '@/features/orders/api/postSaleEvidence'

interface RequestReturnFormProps {
  subOrder: SubOrder
  onRequested: () => void
  onCancel: () => void
}

const REASONS = returnReasonSchema.options.filter((reason) => reason !== 'rto_undelivered')
/** Reasons that require at least one photo before the request can be submitted — mirrors requestReturn.ts's EVIDENCE_REQUIRED_REASONS. */
const EVIDENCE_REQUIRED_REASONS: ReturnReason[] = ['damaged_in_transit', 'defective', 'suspected_spurious']

/** Inline "Request return" form (design item 1), shown only when the caller has already checked the subOrder is `delivered` and within its return window — requestReturn re-validates both server-side (window, non-returnable category, evidence) regardless. */
export function RequestReturnForm({ subOrder, onRequested, onCancel }: RequestReturnFormProps) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const firstItem = subOrder.items[0]
  const [listingId, setListingId] = useState(firstItem?.listingId ?? '')
  const [qty, setQty] = useState(1)
  const [reason, setReason] = useState<ReturnReason>('defective')
  const [notes, setNotes] = useState('')
  const [resolutionPreference, setResolutionPreference] = useState<ReturnResolutionPreference>('refund')
  const [images, setImages] = useState<string[]>([])
  const [videoPath, setVideoPath] = useState<string | undefined>(undefined)
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const selectedItem = subOrder.items.find((item) => item.listingId === listingId)
  const evidenceRequired = EVIDENCE_REQUIRED_REASONS.includes(reason)

  async function handleFilesSelected(fileList: FileList | null) {
    if (!fileList || fileList.length === 0 || !user) return
    setUploading(true)
    try {
      const uploaded = await Promise.all(
        Array.from(fileList)
          .slice(0, 6 - images.length)
          .map((file) => uploadPostSaleEvidence(user.uid, 'returns', file)),
      )
      setImages((prev) => [...prev, ...uploaded])
    } catch {
      toast.error(t('orders.return.evidence.uploadFailed'))
    } finally {
      setUploading(false)
    }
  }

  async function handleVideoSelected(fileList: FileList | null) {
    const file = fileList?.[0]
    if (!file || !user) return
    setUploading(true)
    try {
      setVideoPath(await uploadPostSaleEvidence(user.uid, 'returns', file))
    } catch {
      toast.error(t('orders.return.evidence.uploadFailed'))
    } finally {
      setUploading(false)
    }
  }

  async function handleSubmit() {
    if (!selectedItem) return
    if (evidenceRequired && images.length === 0) {
      toast.error(t('orders.return.evidence.required'))
      return
    }
    setSubmitting(true)
    try {
      await requestReturn({
        subOrderId: subOrder.id,
        listingId: selectedItem.listingId,
        qty,
        reason,
        reasonNotes: notes.trim() || undefined,
        images,
        videoPath,
        resolutionPreference,
      })
      toast.success(t('orders.return.success'))
      onRequested()
    } catch (error) {
      toast.error(t(mapSubOrderActionErrorToI18nKey(error)))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-3 rounded-[6px] border border-steel/20 p-3">
      <div className="space-y-1">
        <label htmlFor="return-item" className="text-sm font-medium text-ink">
          {t('orders.return.itemLabel')}
        </label>
        <select
          id="return-item"
          value={listingId}
          onChange={(event) => {
            setListingId(event.target.value)
            setQty(1)
          }}
          className="min-h-tap w-full rounded-[6px] border border-steel/30 bg-surface p-2 text-sm text-ink"
        >
          {subOrder.items.map((item) => (
            <option key={item.listingId} value={item.listingId}>
              {item.title}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-3">
        <div className="space-y-1">
          <label htmlFor="return-qty" className="text-sm font-medium text-ink">
            {t('orders.return.qtyLabel')}
          </label>
          <input
            id="return-qty"
            type="number"
            min={1}
            max={selectedItem?.qty ?? 1}
            value={qty}
            onChange={(event) => setQty(Math.min(Number(event.target.value) || 1, selectedItem?.qty ?? 1))}
            className="min-h-tap w-20 rounded-[6px] border border-steel/30 bg-surface p-2 text-sm text-ink"
          />
        </div>
        <div className="flex-1 space-y-1">
          <label htmlFor="return-reason" className="text-sm font-medium text-ink">
            {t('orders.return.reasonLabel')}
          </label>
          <select
            id="return-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value as ReturnReason)}
            className="min-h-tap w-full rounded-[6px] border border-steel/30 bg-surface p-2 text-sm text-ink"
          >
            {REASONS.map((option) => (
              <option key={option} value={option}>
                {t(`orders.return.reasons.${option}`)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <fieldset className="space-y-1">
        <legend className="text-sm font-medium text-ink">{t('orders.return.resolutionLabel')}</legend>
        <div className="flex gap-3">
          {(['refund', 'replacement'] as const).map((option) => (
            <label key={option} className="flex min-h-tap items-center gap-2 text-sm text-ink">
              <input
                type="radio"
                name="resolutionPreference"
                checked={resolutionPreference === option}
                onChange={() => setResolutionPreference(option)}
              />
              {t(`orders.return.resolution.${option}`)}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-1">
        <label htmlFor="return-notes" className="text-sm font-medium text-ink">
          {t('orders.return.notesLabel')}
        </label>
        <textarea
          id="return-notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={2}
          className="w-full rounded-[6px] border border-steel/30 bg-surface p-2 text-sm text-ink"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="return-photos" className="text-sm font-medium text-ink">
          {t('orders.return.evidence.photosLabel')}
          {evidenceRequired ? <span className="text-alert"> *</span> : null}
        </label>
        <input
          id="return-photos"
          type="file"
          accept="image/*"
          multiple
          disabled={uploading || images.length >= 6}
          onChange={(event) => {
            void handleFilesSelected(event.target.files)
            event.target.value = ''
          }}
          className="block w-full text-sm text-steel"
        />
        {images.length > 0 ? (
          <p className="text-xs text-steel">{t('orders.return.evidence.photosCount', { count: images.length })}</p>
        ) : null}
        <label htmlFor="return-video" className="text-sm font-medium text-ink">
          {t('orders.return.evidence.videoLabel')}
        </label>
        <input
          id="return-video"
          type="file"
          accept="video/*"
          disabled={uploading || Boolean(videoPath)}
          onChange={(event) => {
            void handleVideoSelected(event.target.files)
            event.target.value = ''
          }}
          className="block w-full text-sm text-steel"
        />
        {videoPath ? <p className="text-xs text-verify">{t('orders.return.evidence.videoAttached')}</p> : null}
      </div>

      <div className="flex gap-2">
        <Button type="button" variant="cta" size="sm" onClick={handleSubmit} disabled={submitting || uploading || !selectedItem}>
          {submitting ? t('common.loading') : t('orders.return.submit')}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={submitting}>
          {t('common.back')}
        </Button>
      </div>
    </div>
  )
}
