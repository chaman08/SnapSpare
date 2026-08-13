import { creditStatementSchema } from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { queueNotificationDirect } from '../orders/notify.js'

const DAY_MS = 24 * 60 * 60_000
const REMINDER_LEAD_DAYS = 3

/**
 * Daily sweep — reminders before and after a Khata statement's due date
 * (design brief item 7). A "before" reminder fires once, the first run on or
 * after `dueDate - 3 days` for a still-`due` statement (`beforeReminderSentAt`
 * gates the repeat). An "after" reminder fires once, the first run on or
 * after `dueDate + 1 day`, which also flips the statement to `overdue` —
 * autoBlockOverdueCredit.ts is what actually suspends the account, after its
 * own grace period on top of this.
 */
export const creditDueReminders = onSchedule({ region: 'asia-south1', schedule: 'every 24 hours' }, async () => {
  const db = getFirestore()
  const now = Date.now()

  const dueSnapshot = await db.collection('creditStatements').where('status', '==', 'due').get()

  await Promise.all(
    dueSnapshot.docs.map(async (doc) => {
      const statement = creditStatementSchema.parse({ id: doc.id, ...doc.data() })

      if (now >= statement.dueDate + DAY_MS) {
        await doc.ref.update({ status: 'overdue', overdueReminderSentAt: now, updatedAt: now })
        await queueNotificationDirect(db, { userId: statement.buyerId, type: 'credit_overdue', language: 'en' })
        return
      }

      if (!statement.beforeReminderSentAt && now >= statement.dueDate - REMINDER_LEAD_DAYS * DAY_MS) {
        await doc.ref.update({ beforeReminderSentAt: now, updatedAt: now })
        await queueNotificationDirect(db, { userId: statement.buyerId, type: 'credit_due_reminder', language: 'en' })
      }
    }),
  )
})
