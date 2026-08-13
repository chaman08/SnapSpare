const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000

/** Start/end epoch-ms bounds (IST calendar month, expressed as UTC instants) for a "YYYY-MM" month string — used by every admin tax report's date-range query. */
export function getMonthBounds(month: string): { startMs: number; endMs: number } {
  const [yearStr, monthStr] = month.split('-')
  const year = Number(yearStr)
  const monthIndex = Number(monthStr) - 1 // 0-based
  const startMs = Date.UTC(year, monthIndex, 1) - IST_OFFSET_MS
  const endMs = Date.UTC(year, monthIndex + 1, 1) - IST_OFFSET_MS
  return { startMs, endMs }
}
