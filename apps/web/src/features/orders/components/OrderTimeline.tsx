import type { TimelineEntry } from '@snapspare/shared'
import { CheckCircle2, CircleDot, PackageCheck, RotateCcw, Truck, XCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

const STATUS_ICON: Record<string, typeof CheckCircle2> = {
  accepted: CheckCircle2,
  packed: PackageCheck,
  shipped: Truck,
  out_for_delivery: Truck,
  delivered: CheckCircle2,
  cancelled: XCircle,
  rejected: XCircle,
  returned: RotateCcw,
  refunded: RotateCcw,
}

const NEGATIVE_STATUSES = new Set(['cancelled', 'rejected'])

interface OrderTimelineProps {
  entries: TimelineEntry[]
  /** i18n namespace prefix used to translate each entry's status label, e.g. `orders.subOrderStatus`. */
  statusI18nPrefix: string
}

/** Vertical status timeline (design item 4) — one dot per subOrder.timeline entry, oldest first, with an icon and a relative actor label. */
export function OrderTimeline({ entries, statusI18nPrefix }: OrderTimelineProps) {
  const { t } = useTranslation()

  if (entries.length === 0) return null

  return (
    <ol className="space-y-0" aria-label={t('orders.timeline.label')}>
      {entries.map((entry, index) => {
        const Icon = STATUS_ICON[entry.status] ?? CircleDot
        const isLast = index === entries.length - 1
        const isNegative = NEGATIVE_STATUSES.has(entry.status)

        return (
          <li key={`${entry.status}-${entry.at}-${index}`} className="relative flex gap-3 pb-6 last:pb-0">
            {!isLast ? (
              <span className="absolute left-[11px] top-6 h-[calc(100%-1.5rem)] w-px bg-steel/20" aria-hidden="true" />
            ) : null}
            <span
              className={cn(
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
                isNegative ? 'bg-alert/10 text-alert' : 'bg-verify/10 text-verify',
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-sm font-medium text-ink">
                {t(`${statusI18nPrefix}.${entry.status}`, { defaultValue: entry.status })}
              </p>
              <p className="text-xs text-steel">
                {new Date(entry.at).toLocaleString()}
                {entry.actor.type !== 'system' ? ` · ${t(`orders.timeline.actor.${entry.actor.type}`)}` : ''}
              </p>
              {entry.note ? <p className="mt-0.5 text-xs text-steel">{entry.note}</p> : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
