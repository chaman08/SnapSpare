import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/components/states/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import { useSellerTrustScore } from '@/features/trust/api/useSellerTrustScore'
import { SellerTrustBadge } from '@/features/trust/components/SellerTrustBadge'
import { cn } from '@/lib/utils'

const COMPONENTS: { key: 'ratingComponent' | 'slaComponent' | 'cancellationComponent' | 'returnComponent' | 'spuriousComponent' | 'tenureComponent'; lever: string }[] = [
  { key: 'ratingComponent', lever: 'rating' },
  { key: 'slaComponent', lever: 'sla' },
  { key: 'cancellationComponent', lever: 'cancellation' },
  { key: 'returnComponent', lever: 'return' },
  { key: 'spuriousComponent', lever: 'spurious' },
  { key: 'tenureComponent', lever: 'tenure' },
]

interface TrustScoreBreakdownProps {
  sellerId: string | undefined
}

/** Seller-dashboard detail view (design brief item 5): the exact levers a seller can pull to improve their trust score, not just the buyer-facing badge. */
export function TrustScoreBreakdown({ sellerId }: TrustScoreBreakdownProps) {
  const { t } = useTranslation()
  const { data: trustScore, isLoading } = useSellerTrustScore(sellerId)

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  if (!trustScore) {
    return <EmptyState title={t('trust.breakdown.emptyTitle')} description={t('trust.breakdown.emptyDescription')} />
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <p className="font-heading text-2xl font-semibold text-ink">{Math.round(trustScore.score)}</p>
        <SellerTrustBadge tier={trustScore.tier} />
      </div>

      <ul className="space-y-3">
        {COMPONENTS.map(({ key, lever }) => {
          const value = trustScore.breakdown[key]
          return (
            <li key={key} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink">{t(`trust.breakdown.component.${lever}`)}</span>
                <span className="font-mono text-steel">{Math.round(value)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-steel/10" role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
                <div className={cn('h-full rounded-full', value >= 80 ? 'bg-verify' : value >= 50 ? 'bg-signal' : 'bg-alert')} style={{ width: `${value}%` }} />
              </div>
              <p className="text-xs text-steel">{t(`trust.breakdown.lever.${lever}`)}</p>
            </li>
          )
        })}
      </ul>

      <p className="text-xs text-steel">
        {t('trust.breakdown.computedAt', { date: new Date(trustScore.computedAt).toLocaleDateString() })}
      </p>
    </div>
  )
}
