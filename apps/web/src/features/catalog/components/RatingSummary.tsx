import type { Review } from '@snapspare/shared'
import { Star } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { aggregateRatings } from '@/features/catalog/lib/ratingAggregate'
import { cn } from '@/lib/utils'

interface RatingSummaryProps {
  reviews: Review[]
  variant?: 'compact' | 'detailed'
  className?: string
}

/** Aggregate rating shown compactly above the fold, or as a full 1–5 star histogram inside the Reviews tab. */
export function RatingSummary({ reviews, variant = 'compact', className }: RatingSummaryProps) {
  const { t } = useTranslation()
  const { average, count } = aggregateRatings(reviews)

  if (count === 0) {
    return <p className={cn('text-sm text-steel', className)}>{t('product.detail.reviews.none')}</p>
  }

  if (variant === 'compact') {
    return (
      <div className={cn('inline-flex items-center gap-1.5 text-sm', className)}>
        <Star className="h-4 w-4 fill-signal text-signal" aria-hidden="true" />
        <span className="font-semibold text-ink">{average.toFixed(1)}</span>
        <span className="text-steel">{t('product.detail.reviews.count', { count })}</span>
      </div>
    )
  }

  const histogram = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((review) => review.rating === star).length,
  }))

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center gap-2">
        <span className="font-heading text-3xl font-semibold text-ink">{average.toFixed(1)}</span>
        <div>
          <div className="flex" aria-hidden="true">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={cn('h-4 w-4', star <= Math.round(average) ? 'fill-signal text-signal' : 'text-steel/30')}
              />
            ))}
          </div>
          <p className="text-xs text-steel">{t('product.detail.reviews.count', { count })}</p>
        </div>
      </div>

      <table className="w-full text-xs">
        <caption className="sr-only">{t('product.detail.reviews.histogramCaption')}</caption>
        <tbody>
          {histogram.map(({ star, count: starCount }) => (
            <tr key={star}>
              <th scope="row" className="w-10 pr-2 text-right font-normal text-steel">
                {t('product.detail.reviews.starLabel', { count: star })}
              </th>
              <td className="w-full py-0.5">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
                  <div
                    className="h-full bg-signal"
                    style={{ width: count > 0 ? `${(starCount / count) * 100}%` : '0%' }}
                  />
                </div>
              </td>
              <td className="w-8 pl-2 text-steel">{starCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
