const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000

/**
 * India's financial year runs 1 April - 31 March. Returns the "FY26-27"
 * style label (Apr 2026 - Mar 2027) used as the middle segment of every GST
 * invoice/credit-note number — see functions/src/tax/invoiceNumbering.ts.
 * Shifted to IST before reading the calendar date so a request landing in
 * the last few hours of March 31st UTC (which is already April 1st IST)
 * isn't mislabeled into the wrong financial year.
 */
export function getFinancialYearLabel(epochMs: number): string {
  const istDate = new Date(epochMs + IST_OFFSET_MS)
  const month = istDate.getUTCMonth() // 0 = January
  const calendarYear = istDate.getUTCFullYear()
  const startYear = month >= 3 ? calendarYear : calendarYear - 1
  const startYearShort = String(startYear % 100).padStart(2, '0')
  const endYearShort = String((startYear + 1) % 100).padStart(2, '0')
  return `FY${startYearShort}-${endYearShort}`
}

/** Start/end epoch-ms bounds (IST financial year, expressed as UTC instants) for the FY containing `epochMs` — used by monthly/quarterly report queries. */
export function getFinancialYearBounds(epochMs: number): { startMs: number; endMs: number } {
  const istDate = new Date(epochMs + IST_OFFSET_MS)
  const month = istDate.getUTCMonth()
  const calendarYear = istDate.getUTCFullYear()
  const startYear = month >= 3 ? calendarYear : calendarYear - 1
  // April 1st 00:00 IST expressed as a UTC instant, and the same for the
  // following April 1st (exclusive upper bound).
  const startMs = Date.UTC(startYear, 3, 1) - IST_OFFSET_MS
  const endMs = Date.UTC(startYear + 1, 3, 1) - IST_OFFSET_MS
  return { startMs, endMs }
}

const QUARTER_START_MONTH_OFFSET: Record<'Q1' | 'Q2' | 'Q3' | 'Q4', number> = {
  Q1: 0, // Apr-Jun
  Q2: 3, // Jul-Sep
  Q3: 6, // Oct-Dec
  Q4: 9, // Jan-Mar
}

/** Start/end epoch-ms bounds (IST, as UTC instants) for one quarter of a "FY26-27"-labelled financial year — Section 194-O's TDS filing cadence (design brief item 4). */
export function getFinancialQuarterBounds(
  financialYear: string,
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4',
): { startMs: number; endMs: number } {
  const match = /^FY(\d{2})-(\d{2})$/.exec(financialYear)
  if (!match) throw new Error(`getFinancialQuarterBounds: malformed financialYear "${financialYear}"`)
  const startYear = 2000 + Number(match[1])
  const startMonth = 3 + QUARTER_START_MONTH_OFFSET[quarter] // April = month index 3
  const startMs = Date.UTC(startYear, startMonth, 1) - IST_OFFSET_MS
  const endMs = Date.UTC(startYear, startMonth + 3, 1) - IST_OFFSET_MS
  return { startMs, endMs }
}
