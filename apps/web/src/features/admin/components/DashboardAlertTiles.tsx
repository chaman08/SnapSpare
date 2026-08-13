import type { AdminDashboardMetrics } from '@snapspare/shared'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

interface DashboardAlertTilesProps {
  alerts: AdminDashboardMetrics['alerts']
}

const TILES: { key: keyof AdminDashboardMetrics['alerts']; to: string }[] = [
  { key: 'slaBreachesOpen', to: '/admin/sellers' },
  { key: 'failedPayouts', to: '/admin/finance' },
  { key: 'stuckPayments', to: '/admin/orders' },
  { key: 'spuriousReportsOpen', to: '/admin/spurious-reports' },
]

/** Operational alert tiles (design brief item 1) — each links straight to the queue that resolves it. Zero-count tiles stay muted rather than shouting for attention. */
export function DashboardAlertTiles({ alerts }: DashboardAlertTilesProps) {
  const { t } = useTranslation()

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {TILES.map(({ key, to }) => {
        const count = alerts[key]
        const active = count > 0
        return (
          <Link
            key={key}
            to={to}
            className={cn(
              'rounded-[6px] border p-4 transition-colors',
              active ? 'border-alert/40 bg-alert/5 hover:bg-alert/10' : 'border-steel/20 bg-surface hover:bg-surface-muted',
            )}
          >
            <p className={cn('font-mono text-2xl font-semibold', active ? 'text-alert' : 'text-ink')}>{count}</p>
            <p className="mt-1 text-xs text-steel">{t(`admin.dashboard.alerts.${key}`)}</p>
          </Link>
        )
      })}
    </div>
  )
}
