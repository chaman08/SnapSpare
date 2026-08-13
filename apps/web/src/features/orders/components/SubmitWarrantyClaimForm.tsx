import type { SubOrder, WarrantyClaimReason } from '@snapspare/shared'
import { warrantyClaimReasonSchema } from '@snapspare/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/api/AuthProvider'
import { mapWarrantyClaimErrorToI18nKey, submitWarrantyClaim } from '@/features/orders/api/warrantyClaimActions'
import { uploadPostSaleEvidence } from '@/features/orders/api/postSaleEvidence'

interface SubmitWarrantyClaimFormProps {
  subOrder: SubOrder
  listingId: string
  onSubmitted: () => void
  onCancel: () => void
}

const REASONS = warrantyClaimReasonSchema.options

/** Buyer-initiated warranty claim (design brief item 6) — separate from a return, valid for months after delivery per the listing's warrantyMonths. Photo evidence is always required. */
export function SubmitWarrantyClaimForm({ subOrder, listingId, onSubmitted, onCancel }: SubmitWarrantyClaimFormProps) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [reason, setReason] = useState<WarrantyClaimReason>('premature_failure')
  const [description, setDescription] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleFilesSelected(fileList: FileList | null) {
    if (!fileList || fileList.length === 0 || !user) return
    setUploading(true)
    try {
      const uploaded = await Promise.all(
        Array.from(fileList)
          .slice(0, 6 - images.length)
          .map((file) => uploadPostSaleEvidence(user.uid, 'warrantyClaims', file)),
      )
      setImages((prev) => [...prev, ...uploaded])
    } catch {
      toast.error(t('orders.return.evidence.uploadFailed'))
    } finally {
      setUploading(false)
    }
  }

  async function handleSubmit() {
    if (images.length === 0) {
      toast.error(t('orders.warranty.evidenceRequired'))
      return
    }
    if (description.trim().length === 0) return
    setSubmitting(true)
    try {
      await submitWarrantyClaim({
        subOrderId: subOrder.id,
        listingId,
        reason,
        description: description.trim(),
        evidenceImages: images,
      })
      toast.success(t('orders.warranty.success'))
      onSubmitted()
    } catch (error) {
      toast.error(t(mapWarrantyClaimErrorToI18nKey(error)))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-3 rounded-[6px] border border-steel/20 p-3">
      <div className="space-y-1">
        <label htmlFor="warranty-reason" className="text-sm font-medium text-ink">
          {t('orders.warranty.reasonLabel')}
        </label>
        <select
          id="warranty-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value as WarrantyClaimReason)}
          className="min-h-tap w-full rounded-[6px] border border-steel/30 bg-surface p-2 text-sm text-ink"
        >
          {REASONS.map((option) => (
            <option key={option} value={option}>
              {t(`orders.warranty.reasons.${option}`)}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label htmlFor="warranty-description" className="text-sm font-medium text-ink">
          {t('orders.warranty.descriptionLabel')}
        </label>
        <textarea
          id="warranty-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
          className="w-full rounded-[6px] border border-steel/30 bg-surface p-2 text-sm text-ink"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="warranty-photos" className="text-sm font-medium text-ink">
          {t('orders.return.evidence.photosLabel')} <span className="text-alert">*</span>
        </label>
        <input
          id="warranty-photos"
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
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          variant="cta"
          size="sm"
          onClick={handleSubmit}
          disabled={submitting || uploading || description.trim().length === 0}
        >
          {submitting ? t('common.loading') : t('orders.warranty.submit')}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={submitting}>
          {t('common.back')}
        </Button>
      </div>
    </div>
  )
}
