import type { Review } from '@snapspare/shared'
import { Star } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { EmptyState } from '@/components/states/EmptyState'
import { ErrorState } from '@/components/states/ErrorState'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/features/auth/api/AuthProvider'
import { useReviewsForPart } from '@/features/catalog/api/useReviewsForPart'
import { RatingSummary } from '@/features/catalog/components/RatingSummary'
import { mapReviewErrorToI18nKey, respondToReview } from '@/features/orders/api/reviewActions'
import { cn } from '@/lib/utils'

function MiniStars({ value }: { value: number }) {
  return (
    <div className="flex" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star key={star} className={cn('h-3 w-3', star <= value ? 'fill-signal text-signal' : 'text-steel/30')} />
      ))}
    </div>
  )
}

function SellerReplyForm({ reviewId, onPosted }: { reviewId: string; onPosted: () => void }) {
  const { t } = useTranslation()
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    if (!comment.trim()) return
    setSubmitting(true)
    try {
      await respondToReview({ reviewId, comment: comment.trim() })
      toast.success(t('reviews.sellerReply.success'))
      onPosted()
    } catch (error) {
      toast.error(t(mapReviewErrorToI18nKey(error)))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mt-2 space-y-1.5">
      <textarea
        rows={2}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder={t('reviews.sellerReply.placeholder')}
        className="w-full rounded-[6px] border border-steel/30 bg-surface p-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
      />
      <Button type="button" variant="outline" size="sm" disabled={submitting || !comment.trim()} onClick={handleSubmit}>
        {submitting ? t('common.loading') : t('reviews.sellerReply.submit')}
      </Button>
    </div>
  )
}

interface ReviewsTabProps {
  partId: string
  listingIds: string[]
}

function ReviewRow({ review, canReplyAsSeller, onChanged }: { review: Review; canReplyAsSeller: boolean; onChanged: () => void }) {
  const { t } = useTranslation()
  const [replying, setReplying] = useState(false)

  return (
    <li className="border-b border-steel/15 py-4 last:border-0">
      {review.vehicleFitted ? (
        <p className="mb-1.5 inline-block rounded-full bg-verify/10 px-2 py-0.5 text-xs font-medium text-verify">
          {t('product.detail.reviews.fittedTo', { vehicle: review.vehicleFitted.label })}
        </p>
      ) : null}
      <div className="mb-1 flex items-center gap-2">
        <div className="flex" aria-hidden="true">
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              className={cn('h-3.5 w-3.5', star <= review.rating ? 'fill-signal text-signal' : 'text-steel/30')}
            />
          ))}
        </div>
        <span className="sr-only">{t('product.detail.reviews.starLabel', { count: review.rating })}</span>
        {review.verifiedPurchase ? (
          <span className="rounded-full bg-verify/10 px-2 py-0.5 text-[11px] font-medium text-verify">
            {t('product.detail.reviews.verifiedPurchase')}
          </span>
        ) : null}
      </div>
      {review.title ? <p className="text-sm font-medium text-ink">{review.title}</p> : null}
      {review.comment ? <p className="mt-0.5 text-sm text-steel">{review.comment}</p> : null}

      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-steel">
        <span className="flex items-center gap-1">
          {t('product.detail.reviews.fitmentAccurate')}: {t(review.fitmentAccurate ? 'common.yes' : 'common.no')}
        </span>
        <span className="flex items-center gap-1">
          {t('product.detail.reviews.qualityRating')}: <MiniStars value={review.qualityRating} />
        </span>
        <span className="flex items-center gap-1">
          {t('product.detail.reviews.valueRating')}: <MiniStars value={review.valueRating} />
        </span>
      </div>

      {review.images.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-2">
          {review.images.map((url) => (
            <li key={url}>
              <img src={url} alt="" className="h-16 w-16 rounded-[6px] object-cover" />
            </li>
          ))}
        </ul>
      ) : null}

      <p className="mt-1.5 text-xs text-steel">
        {review.buyerDisplayName || t('product.detail.reviews.anonymousBuyer')}
      </p>

      {review.sellerReply ? (
        <div className="mt-2 rounded-[6px] bg-surface-muted p-2.5">
          <p className="text-xs font-medium text-ink">{t('product.detail.reviews.sellerReply')}</p>
          <p className="mt-0.5 text-xs text-steel">{review.sellerReply.comment}</p>
        </div>
      ) : canReplyAsSeller ? (
        replying ? (
          <SellerReplyForm reviewId={review.id} onPosted={() => { setReplying(false); onChanged() }} />
        ) : (
          <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => setReplying(true)}>
            {t('reviews.sellerReply.action')}
          </Button>
        )
      ) : null}
    </li>
  )
}

export function ReviewsTab({ partId, listingIds }: ReviewsTabProps) {
  const { t } = useTranslation()
  const { claims } = useAuth()
  const reviewsQuery = useReviewsForPart(partId, listingIds)
  const reviews = reviewsQuery.data ?? []

  if (reviewsQuery.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-48" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    )
  }

  if (reviewsQuery.isError) {
    return <ErrorState onRetry={() => reviewsQuery.refetch()} />
  }

  if (reviews.length === 0) {
    return <EmptyState title={t('product.detail.reviews.emptyTitle')} description={t('product.detail.reviews.emptyDescription')} />
  }

  return (
    <div className="grid gap-6 md:grid-cols-[200px_1fr]">
      <RatingSummary reviews={reviews} variant="detailed" />
      <ul>
        {reviews.map((review) => (
          <ReviewRow
            key={review.id}
            review={review}
            canReplyAsSeller={Boolean(claims?.sellerId) && claims?.sellerId === review.sellerId}
            onChanged={() => reviewsQuery.refetch()}
          />
        ))}
      </ul>
    </div>
  )
}
