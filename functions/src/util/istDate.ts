/** India has no DST, so a fixed UTC+5:30 offset is exact — no timezone-database dependency needed for Asia/Kolkata day-boundary math. */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

/** `YYYY-MM-DD` for the Asia/Kolkata calendar day containing `epochMs`. */
export function istDateString(epochMs: number): string {
  return new Date(epochMs + IST_OFFSET_MS).toISOString().slice(0, 10)
}

/** `YYYY-MM` for the Asia/Kolkata calendar month containing `epochMs`. */
export function istMonthString(epochMs: number): string {
  return istDateString(epochMs).slice(0, 7)
}

/** [startMs, endMs) epoch-ms bounds of the Asia/Kolkata calendar day `dateString` ("YYYY-MM-DD"). */
export function istDayRangeMs(dateString: string): { startMs: number; endMs: number } {
  const startMs = Date.parse(`${dateString}T00:00:00.000Z`) - IST_OFFSET_MS
  return { startMs, endMs: startMs + DAY_MS }
}

/** The `YYYY-MM-DD` for "yesterday" in Asia/Kolkata, relative to now — the day a rollup scheduled just after IST midnight should process. */
export function istYesterdayString(now: number = Date.now()): string {
  return istDateString(now - DAY_MS)
}

/** Epoch ms of the start (Asia/Kolkata midnight, day 1) of month `monthString` ("YYYY-MM"). */
export function istMonthStartMs(monthString: string): number {
  return Date.parse(`${monthString}-01T00:00:00.000Z`) - IST_OFFSET_MS
}

/** Adds `months` calendar months to a `YYYY-MM` string. */
export function addMonths(monthString: string, months: number): string {
  const [year, month] = monthString.split('-').map(Number)
  const total = (year! - 1970) * 12 + (month! - 1) + months
  const newYear = 1970 + Math.floor(total / 12)
  const newMonth = ((total % 12) + 12) % 12
  return `${newYear}-${String(newMonth + 1).padStart(2, '0')}`
}
