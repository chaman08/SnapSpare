import type { SellerDailyStats } from '@snapspare/shared'
import { useTranslation } from 'react-i18next'

interface ConversionCardProps {
  stats: SellerDailyStats[]
  totalViewCount: number
  isLoading: boolean
}

/**
 * Approximate conversion rate — units sold over the selected range divided
 * by the seller's CURRENT all-time listing view count, not a true per-range
 * cohort conversion (that would require daily view-count snapshots, which
 * nothing in the codebase captures yet — `listing.viewCount` is a running
 * cumulative total, not date-bucketed). Labelled as an estimate rather than
 * silently presented as exact.
 */
export function ConversionCard({ stats, totalViewCount, isLoading }: ConversionCardProps) {
  const { t } = useTranslation()
  const unitsSold = stats.reduce((sum, day) => sum + day.unitsSold, 0)
  const conversionPercent = totalViewCount > 0 ? (unitsSold / totalViewCount) * 100 : undefined

  return (
    <section className="rounded-[6px] border border-steel/20 bg-surface p-4" aria-labelledby="conversion-heading">
      <h2 id="conversion-heading" className="font-heading text-lg font-semibold text-ink">
        {t('sellerDashboard.conversion.title')}
      </h2>
      <p className="mt-1 font-mono text-2xl font-semibold text-ink" aria-live="polite">
        {isLoading ? '—' : conversionPercent === undefined ? '—' : `${conversionPercent.toFixed(1)}%`}
      </p>
      <p className="mt-1 text-xs text-steel">{t('sellerDashboard.conversion.caveat')}</p>
    </section>
  )
}
