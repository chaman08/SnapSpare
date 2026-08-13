import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

interface DashboardMetricTileProps {
  label: string
  value: string
  changePercent: number | null
  /** Whether an increase is good news (GMV) or bad news (e.g. a fraud/failure rate) — flips the green/red coloring. Defaults to true. */
  higherIsBetter?: boolean
}

/** One KPI tile with a period-over-period comparison badge — the repeated shape behind every Dashboard metric. */
export function DashboardMetricTile({ label, value, changePercent, higherIsBetter = true }: DashboardMetricTileProps) {
  const { t } = useTranslation()
  const isPositive = changePercent !== null && changePercent >= 0
  const isGood = changePercent === null ? null : higherIsBetter ? isPositive : !isPositive

  return (
    <div className="rounded-[6px] border border-steel/20 bg-surface p-4">
      <p className="text-xs text-steel">{label}</p>
      <p className="mt-1 font-mono text-2xl font-semibold text-ink">{value}</p>
      {changePercent !== null ? (
        <p className={cn('mt-1 text-xs font-medium', isGood ? 'text-verify' : 'text-alert')}>
          {isPositive ? '+' : ''}
          {changePercent.toFixed(1)}% {t('admin.dashboard.vsPreviousPeriod')}
        </p>
      ) : (
        <p className="mt-1 text-xs text-steel">—</p>
      )}
    </div>
  )
}
