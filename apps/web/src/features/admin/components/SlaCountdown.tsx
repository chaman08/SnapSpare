import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

interface SlaCountdownProps {
  deadlineMs: number
  /** Below this many hours remaining, the badge switches to the alert color. */
  warnWithinHours?: number
}

/** Returns & disputes module's SLA timer badge (design brief item 7) — reused by both the Returns queue and (via the same pattern) DisputesQueue's own inline countdown. */
export function SlaCountdown({ deadlineMs, warnWithinHours = 24 }: SlaCountdownProps) {
  const { t } = useTranslation()
  const hoursLeft = (deadlineMs - Date.now()) / (60 * 60_000)
  const breached = hoursLeft <= 0
  const warning = !breached && hoursLeft <= warnWithinHours

  const label = breached
    ? t('admin.sla.breached')
    : hoursLeft < 24
      ? t('admin.sla.hoursLeft', { count: Math.max(0, Math.round(hoursLeft)) })
      : t('admin.sla.daysLeft', { count: Math.round(hoursLeft / 24) })

  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-xs font-medium',
        breached || warning ? 'bg-alert/10 text-alert' : 'bg-ink/10 text-ink',
      )}
    >
      {label}
    </span>
  )
}
