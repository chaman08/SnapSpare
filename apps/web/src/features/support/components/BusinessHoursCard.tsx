import type { BusinessHours, BusinessHoursDay } from '@snapspare/shared'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

const DAY_KEYS: (keyof Omit<BusinessHours, 'timezone'>)[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]

/** IST day-of-week index (0 = Sunday) mapped onto our Monday-first DAY_KEYS ordering. */
function currentIstDayKey(): (typeof DAY_KEYS)[number] {
  const istNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
  const jsDay = istNow.getDay() // 0 = Sunday
  return DAY_KEYS[(jsDay + 6) % 7] as (typeof DAY_KEYS)[number]
}

function formatDay(day: BusinessHoursDay): string {
  if (day.closed || !day.opensAt || !day.closesAt) return ''
  return `${day.opensAt} – ${day.closesAt}`
}

/** Phase 24 (launch readiness): renders config/app.supportBusinessHours — today's status first (open/closed right now, IST), then the full week for reference. */
export function BusinessHoursCard({ hours }: { hours: BusinessHours }) {
  const { t } = useTranslation()
  const todayKey = currentIstDayKey()
  const today = hours[todayKey]

  return (
    <div className="rounded-[6px] border border-steel/20 bg-surface p-4">
      <h2 className="font-heading text-base font-semibold text-ink">{t('support.businessHours.title')}</h2>
      <p className={cn('mt-1 text-sm font-medium', today.closed ? 'text-alert' : 'text-verify')}>
        {today.closed ? t('support.businessHours.closedToday') : t('support.businessHours.openToday', { hours: formatDay(today) })}
      </p>
      <dl className="mt-3 space-y-1 text-sm">
        {DAY_KEYS.map((key) => {
          const day = hours[key]
          return (
            <div key={key} className="flex items-center justify-between">
              <dt className={cn('text-steel', key === todayKey && 'font-semibold text-ink')}>{t(`support.businessHours.day.${key}`)}</dt>
              <dd className={cn('font-mono text-ink', key === todayKey && 'font-semibold')}>
                {day.closed ? t('support.businessHours.closed') : formatDay(day)}
              </dd>
            </div>
          )
        })}
      </dl>
      <p className="mt-2 text-xs text-steel">{t('support.businessHours.timezoneNote')}</p>
    </div>
  )
}
