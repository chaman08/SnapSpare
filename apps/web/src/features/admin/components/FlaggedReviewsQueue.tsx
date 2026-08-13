import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { EmptyState } from '@/components/states/EmptyState'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { moderateReview, usePendingFlaggedReviews } from '@/features/admin/api/reviewModerationActions'

/** Admin moderation queue for reviews the automated screen flagged (design brief item 2). */
export function FlaggedReviewsQueue() {
  const { t } = useTranslation()
  const { reviews, loading } = usePendingFlaggedReviews()
  const [busyId, setBusyId] = useState<string | null>(null)

  async function handle(reviewId: string, action: 'approve' | 'reject') {
    setBusyId(reviewId)
    try {
      await moderateReview({ reviewId, action })
      toast.success(t(`admin.reviewModeration.action.${action}Success`))
    } catch {
      toast.error(t('admin.reviewModeration.actionFailed'))
    } finally {
      setBusyId(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  if (reviews.length === 0) {
    return <EmptyState title={t('admin.reviewModeration.emptyTitle')} description={t('admin.reviewModeration.emptyDescription')} />
  }

  return (
    <ul className="space-y-3">
      {reviews.map((review) => (
        <li key={review.id} className="space-y-2 rounded-[6px] border border-alert/30 bg-alert/5 p-4">
          <div className="flex flex-wrap gap-1">
            {review.moderationFlags.map((flag) => (
              <span key={flag} className="rounded-full bg-alert/10 px-2 py-0.5 text-xs font-medium text-alert">
                {t(`admin.reviewModeration.flag.${flag}`, { defaultValue: flag })}
              </span>
            ))}
          </div>
          {review.title ? <p className="text-sm font-medium text-ink">{review.title}</p> : null}
          {review.comment ? <p className="text-sm text-steel">{review.comment}</p> : null}
          <p className="font-mono text-xs text-steel">{review.id}</p>
          <div className="flex gap-2">
            <Button type="button" variant="cta" size="sm" disabled={busyId === review.id} onClick={() => handle(review.id, 'approve')}>
              {t('admin.reviewModeration.action.approve')}
            </Button>
            <Button type="button" variant="destructive" size="sm" disabled={busyId === review.id} onClick={() => handle(review.id, 'reject')}>
              {t('admin.reviewModeration.action.reject')}
            </Button>
          </div>
        </li>
      ))}
    </ul>
  )
}
