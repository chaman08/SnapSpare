import { creditAccountSchema, getMonthBounds } from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { queueNotificationDirect } from '../orders/notify.js'

const DAY_MS = 24 * 60 * 60_000
const DEFAULT_DUE_DAYS_AFTER_STATEMENT = 15

/** "YYYY-MM" for the calendar month before `now` (IST, matching getMonthBounds' calendar). */
function previousMonthLabel(now: number): string {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000
  const istNow = new Date(now + IST_OFFSET_MS)
  const year = istNow.getUTCFullYear()
  const monthIndex = istNow.getUTCMonth() // 0-based, current month
  const prevMonthIndex = monthIndex === 0 ? 11 : monthIndex - 1
  const prevYear = monthIndex === 0 ? year - 1 : year
  return `${prevYear}-${String(prevMonthIndex + 1).padStart(2, '0')}`
}

/**
 * Monthly Khata statement (design brief item 7) — runs on the 1st of every
 * month, one statement per active credit account with an outstanding
 * balance for the just-closed calendar month. Deterministic doc id
 * `creditStatements/{creditAccountId}_{month}` makes a duplicate/retried
 * invocation a no-op. `dueDate` uses the account's `dueDay` (day-of-month)
 * when set, falling back to statement-date + 15 days.
 */
export const generateMonthlyStatement = onSchedule(
  { region: 'asia-south1', schedule: '0 2 1 * *', timeZone: 'Asia/Kolkata' },
  async () => {
    const db = getFirestore()
    const now = Date.now()
    const month = previousMonthLabel(now)
    const { startMs: periodFrom, endMs: periodTo } = getMonthBounds(month)

    const snapshot = await db.collection('creditAccounts').where('status', '==', 'active').get()

    await Promise.all(
      snapshot.docs.map(async (doc) => {
        const account = creditAccountSchema.parse({ id: doc.id, ...doc.data() })
        if (account.outstandingPaise <= 0) return

        const statementRef = db.collection('creditStatements').doc(`${account.id}_${month}`)
        const existing = await statementRef.get()
        if (existing.exists) return

        const dueDate = account.dueDay
          ? nextOccurrenceOfDayOfMonth(periodTo, account.dueDay)
          : periodTo + DEFAULT_DUE_DAYS_AFTER_STATEMENT * DAY_MS

        await statementRef.set({
          creditAccountId: account.id,
          buyerId: account.buyerId,
          periodFrom,
          periodTo,
          openingBalancePaise: account.outstandingPaise,
          closingBalancePaise: account.outstandingPaise,
          amountDuePaise: account.outstandingPaise,
          dueDate,
          status: 'due',
          createdAt: now,
          updatedAt: now,
        })

        await queueNotificationDirect(db, { userId: account.buyerId, type: 'credit_statement_ready', language: 'en' }).catch(
          (error) => logger.warn('generateMonthlyStatement: notify failed', { creditAccountId: account.id, error }),
        )
      }),
    )
  },
)

/** The next calendar date on/after `fromMs` that falls on `dayOfMonth` (1-28). */
function nextOccurrenceOfDayOfMonth(fromMs: number, dayOfMonth: number): number {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000
  const d = new Date(fromMs + IST_OFFSET_MS)
  const candidate = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), dayOfMonth) - IST_OFFSET_MS
  return candidate >= fromMs ? candidate : Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, dayOfMonth) - IST_OFFSET_MS
}
