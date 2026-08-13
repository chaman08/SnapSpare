import type { SubOrderItem } from '@snapspare/shared'
import { MAX_REVIEW_IMAGES } from '@snapspare/shared'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { Loader2, Star, Upload, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { compressImageIfNeeded } from '@/features/sellerOnboarding/lib/compressImage'
import { mapReviewErrorToI18nKey, submitReview } from '@/features/orders/api/reviewActions'
import { storage } from '@/lib/firebase'
import { cn } from '@/lib/utils'

interface ReviewFormProps {
  orderId: string
  subOrderId: string
  sellerId: string
  buyerId: string
  buyerDisplayName?: string
  item: SubOrderItem
  onSubmitted: () => void
  onCancel: () => void
}

function StarPicker({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium text-ink">{label}</p>
      <div className="flex gap-1" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={String(star)}
            onClick={() => onChange(star)}
            className="min-h-tap min-w-tap p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
          >
            <Star className={cn('h-6 w-6', star <= value ? 'fill-signal text-signal' : 'text-steel/30')} aria-hidden="true" />
          </button>
        ))}
      </div>
    </div>
  )
}

/** Review-authoring form (design brief item 1) — reached from the order-detail "Write a review" action once a subOrder is delivered. `vehicleFitted` is auto-filled from the subOrder item, never re-asked. */
export function ReviewForm({ orderId, subOrderId, sellerId, buyerId, buyerDisplayName, item, onSubmitted, onCancel }: ReviewFormProps) {
  const { t } = useTranslation()
  const [rating, setRating] = useState(5)
  const [fitmentAccurate, setFitmentAccurate] = useState<boolean | null>(null)
  const [qualityRating, setQualityRating] = useState(5)
  const [valueRating, setValueRating] = useState(5)
  const [title, setTitle] = useState('')
  const [comment, setComment] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleFilesSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    if (files.length === 0) return
    setUploading(true)
    try {
      const remaining = Math.max(0, MAX_REVIEW_IMAGES - images.length)
      const uploaded: string[] = []
      for (const file of files.slice(0, remaining)) {
        const compressed = await compressImageIfNeeded(file)
        const path = `users/${buyerId}/reviews/${Date.now()}-${compressed.name}`
        const storageRef = ref(storage, path)
        await uploadBytes(storageRef, compressed)
        uploaded.push(await getDownloadURL(storageRef))
      }
      setImages((prev) => [...prev, ...uploaded])
    } catch {
      toast.error(t('common.somethingWentWrong'))
    } finally {
      setUploading(false)
      event.target.value = ''
    }
  }

  async function handleSubmit() {
    if (fitmentAccurate === null) return
    setSubmitting(true)
    try {
      await submitReview({
        orderId,
        subOrderId,
        listingId: item.listingId,
        partId: item.partId,
        sellerId,
        buyerId,
        buyerDisplayName,
        rating,
        fitmentAccurate,
        qualityRating,
        valueRating,
        title: title.trim() || undefined,
        comment: comment.trim() || undefined,
        images,
        vehicleFitted: item.vehicleId && item.vehicleLabel ? { vehicleId: item.vehicleId, label: item.vehicleLabel } : undefined,
      })
      toast.success(t('reviews.form.success'))
      onSubmitted()
    } catch (error) {
      toast.error(t(mapReviewErrorToI18nKey(error)))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4 rounded-[6px] border border-steel/20 p-4">
      <p className="text-sm font-medium text-ink">{t('reviews.form.title', { item: item.title })}</p>

      {item.vehicleLabel ? (
        <p className="rounded-[6px] bg-verify/10 px-3 py-2 text-sm text-verify">
          {t('reviews.form.fittedTo', { vehicle: item.vehicleLabel })}
        </p>
      ) : null}

      <StarPicker value={rating} onChange={setRating} label={t('reviews.form.overallRating')} />
      <StarPicker value={qualityRating} onChange={setQualityRating} label={t('reviews.form.qualityRating')} />
      <StarPicker value={valueRating} onChange={setValueRating} label={t('reviews.form.valueRating')} />

      <div className="space-y-1">
        <p className="text-sm font-medium text-ink">{t('reviews.form.fitmentAccurateLabel')}</p>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={fitmentAccurate === true ? 'cta' : 'outline'}
            onClick={() => setFitmentAccurate(true)}
          >
            {t('common.yes')}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={fitmentAccurate === false ? 'cta' : 'outline'}
            onClick={() => setFitmentAccurate(false)}
          >
            {t('common.no')}
          </Button>
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="review-title">{t('reviews.form.titleLabel')}</Label>
        <input
          id="review-title"
          value={title}
          maxLength={120}
          onChange={(e) => setTitle(e.target.value)}
          className="min-h-tap w-full rounded-[6px] border border-steel/30 bg-surface px-3 text-base text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="review-comment">{t('reviews.form.commentLabel')}</Label>
        <textarea
          id="review-comment"
          rows={4}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="w-full rounded-[6px] border border-steel/30 bg-surface p-2 text-base text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
        />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-ink">{t('reviews.form.photosLabel', { max: MAX_REVIEW_IMAGES })}</p>
        {images.length > 0 ? (
          <ul className="grid grid-cols-4 gap-2">
            {images.map((url) => (
              <li key={url} className="group relative overflow-hidden rounded-[6px] border border-steel/20 bg-surface">
                <img src={url} alt="" className="aspect-square w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setImages((prev) => prev.filter((u) => u !== url))}
                  aria-label={t('common.remove')}
                  className="absolute right-1 top-1 flex min-h-tap min-w-tap items-center justify-center rounded-[6px] bg-ink/60 text-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <input
          type="file"
          id="review-photo-input"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          multiple
          className="sr-only"
          onChange={handleFilesSelected}
          aria-label={t('reviews.form.addPhoto')}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading || images.length >= MAX_REVIEW_IMAGES}
          onClick={() => document.getElementById('review-photo-input')?.click()}
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Upload className="h-4 w-4" aria-hidden="true" />}
          {uploading ? t('common.loading') : t('reviews.form.addPhoto')}
        </Button>
      </div>

      <div className="flex gap-2">
        <Button type="button" variant="cta" size="sm" disabled={submitting || fitmentAccurate === null} onClick={handleSubmit}>
          {submitting ? t('common.loading') : t('reviews.form.submit')}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={submitting}>
          {t('common.back')}
        </Button>
      </div>
    </div>
  )
}
