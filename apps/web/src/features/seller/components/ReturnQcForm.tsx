import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/api/AuthProvider'
import { uploadPostSaleEvidence } from '@/features/orders/api/postSaleEvidence'
import { submitReturnQc } from '@/features/seller/api/returnActions'

interface ReturnQcFormProps {
  returnId: string
  onDone: () => void
}

/** Seller QC on a received return (design brief item 3): photos required either way, pass resolves the return (refund/replacement), dispute flags it for admin escalation. */
export function ReturnQcForm({ returnId, onDone }: ReturnQcFormProps) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [photos, setPhotos] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleFilesSelected(fileList: FileList | null) {
    if (!fileList || fileList.length === 0 || !user) return
    setUploading(true)
    try {
      const uploaded = await Promise.all(
        Array.from(fileList)
          .slice(0, 6 - photos.length)
          .map((file) => uploadPostSaleEvidence(user.uid, 'returnsQc', file)),
      )
      setPhotos((prev) => [...prev, ...uploaded])
    } catch {
      toast.error(t('orders.return.evidence.uploadFailed'))
    } finally {
      setUploading(false)
    }
  }

  async function handleOutcome(outcome: 'pass' | 'dispute') {
    if (photos.length === 0) {
      toast.error(t('sellerOrders.returns.qc.photosRequired'))
      return
    }
    setSubmitting(true)
    try {
      await submitReturnQc({ returnId, outcome, photos, note: note.trim() || undefined })
      toast.success(t(outcome === 'pass' ? 'sellerOrders.returns.qc.passSuccess' : 'sellerOrders.returns.qc.disputeSuccess'))
      onDone()
    } catch {
      toast.error(t('sellerOrders.returns.qc.failure'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mt-3 space-y-2 rounded-[6px] border border-steel/20 bg-surface-muted p-3">
      <label htmlFor={`qc-photos-${returnId}`} className="text-sm font-medium text-ink">
        {t('sellerOrders.returns.qc.photosLabel')}
      </label>
      <input
        id={`qc-photos-${returnId}`}
        type="file"
        accept="image/*"
        multiple
        disabled={uploading || photos.length >= 6}
        onChange={(event) => {
          void handleFilesSelected(event.target.files)
          event.target.value = ''
        }}
        className="block w-full text-sm text-steel"
      />
      {photos.length > 0 ? (
        <p className="text-xs text-steel">{t('orders.return.evidence.photosCount', { count: photos.length })}</p>
      ) : null}
      <textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        rows={2}
        placeholder={t('sellerOrders.returns.qc.noteLabel')}
        className="w-full rounded-[6px] border border-steel/30 bg-surface p-2 text-sm text-ink"
      />
      <div className="flex gap-2">
        <Button type="button" variant="cta" size="sm" disabled={submitting || uploading} onClick={() => handleOutcome('pass')}>
          {t('sellerOrders.returns.qc.pass')}
        </Button>
        <Button type="button" variant="destructive" size="sm" disabled={submitting || uploading} onClick={() => handleOutcome('dispute')}>
          {t('sellerOrders.returns.qc.dispute')}
        </Button>
      </div>
    </div>
  )
}
