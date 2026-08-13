/**
 * Plain-number and date/time formatting via the Intl APIs, pinned to en-IN so
 * grouping always reads the Indian way (1,20,000) regardless of which UI
 * language is active — locale (language of labels) and region formatting
 * (how digits/dates are grouped) are deliberately kept independent here.
 *
 * Money stays on `formatINR` from @snapspare/shared (integer paise in, a
 * ₹-prefixed string out) — this file is for everything that isn't a rupee
 * amount: quantities, counts, ratings, order/response dates, etc.
 */
const NUMBER_LOCALE = 'en-IN'

const integerFormatter = new Intl.NumberFormat(NUMBER_LOCALE)

export function formatNumber(value: number): string {
  return integerFormatter.format(value)
}

export function formatPercent(value: number, fractionDigits = 0): string {
  return new Intl.NumberFormat(NUMBER_LOCALE, {
    style: 'percent',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value / 100)
}

const dateFormatter = new Intl.DateTimeFormat(NUMBER_LOCALE, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

export function formatDate(value: Date | number): string {
  return dateFormatter.format(value)
}

const dateTimeFormatter = new Intl.DateTimeFormat(NUMBER_LOCALE, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

export function formatDateTime(value: Date | number): string {
  return dateTimeFormatter.format(value)
}

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 1000 * 60 * 60 * 24 * 365],
  ['month', 1000 * 60 * 60 * 24 * 30],
  ['week', 1000 * 60 * 60 * 24 * 7],
  ['day', 1000 * 60 * 60 * 24],
  ['hour', 1000 * 60 * 60],
  ['minute', 1000 * 60],
]

const relativeFormatter = new Intl.RelativeTimeFormat(NUMBER_LOCALE, { numeric: 'auto' })

/** e.g. "3 days ago" / "in 2 hours" — falls back to formatDate beyond a year. */
export function formatRelativeTime(value: Date | number, now: Date | number = Date.now()): string {
  const diffMs = new Date(value).getTime() - new Date(now).getTime()
  for (const [unit, unitMs] of RELATIVE_UNITS) {
    if (Math.abs(diffMs) >= unitMs || unit === 'minute') {
      return relativeFormatter.format(Math.round(diffMs / unitMs), unit)
    }
  }
  return formatDate(value)
}
