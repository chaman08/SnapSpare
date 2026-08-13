import type { CohortRetention } from '@snapspare/shared'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/components/states/EmptyState'
import { ErrorState } from '@/components/states/ErrorState'
import { Skeleton } from '@/components/ui/skeleton'
import { RETENTION_MONTH_OFFSETS } from '@/features/admin/api/useCohortRetention'

interface CohortRetentionHeatmapProps {
  cohorts: CohortRetention[] | undefined
  isLoading: boolean
  isError: boolean
  onRetry: () => void
}

/**
 * Sequential single-hue (--verify green) ramp, light→dark by retention %, per
 * the dataviz skill's rule for magnitude encoding — a fixed 6-step opacity
 * scale rather than 6 distinct named ramp steps (this design system exposes
 * one CSS var per semantic color, not a multi-step ramp token set), which
 * keeps the hue constant and only lightness varies, same intent.
 */
function cellBackground(percent: number | null): string {
  if (percent === null) return 'transparent'
  const opacity = Math.max(0.08, Math.min(1, percent / 100))
  return `rgb(var(--verify) / ${opacity.toFixed(2)})`
}

function cellTextClass(percent: number | null): string {
  if (percent === null) return 'text-steel'
  return percent >= 55 ? 'text-surface' : 'text-ink'
}

export function CohortRetentionHeatmap({ cohorts, isLoading, isError, onRetry }: CohortRetentionHeatmapProps) {
  const { t } = useTranslation()

  if (isLoading) return <Skeleton className="h-64 w-full" />
  if (isError) return <ErrorState onRetry={onRetry} />
  if (!cohorts || cohorts.length === 0) return <EmptyState title={t('admin.analytics.cohort.empty')} />

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse text-xs">
        <caption className="sr-only">{t('admin.analytics.cohort.tableCaption')}</caption>
        <thead>
          <tr>
            <th scope="col" className="p-2 text-left font-medium text-steel">
              {t('admin.analytics.cohort.cohortMonth')}
            </th>
            <th scope="col" className="p-2 text-right font-medium text-steel">
              {t('admin.analytics.cohort.cohortSize')}
            </th>
            {RETENTION_MONTH_OFFSETS.map((offset) => (
              <th key={offset} scope="col" className="p-2 text-center font-medium text-steel">
                {t('admin.analytics.cohort.monthOffset', { count: offset })}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cohorts.map((cohort) => (
            <tr key={cohort.id} className="border-t border-steel/10">
              <th scope="row" className="p-2 text-left font-mono font-normal text-ink">
                {cohort.cohortMonth}
              </th>
              <td className="p-2 text-right font-mono text-ink">{cohort.cohortSize}</td>
              {RETENTION_MONTH_OFFSETS.map((offset) => {
                const count = cohort.retention[String(offset)]
                const percent = count === undefined || cohort.cohortSize === 0 ? null : Math.round((count / cohort.cohortSize) * 100)
                return (
                  <td
                    key={offset}
                    className={`p-2 text-center font-mono ${cellTextClass(percent)}`}
                    style={{ backgroundColor: cellBackground(percent) }}
                  >
                    {percent === null ? '—' : `${percent}%`}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
