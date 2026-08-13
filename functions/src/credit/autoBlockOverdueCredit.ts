import { creditAccountSchema, creditStatementSchema } from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { queueNotificationDirect } from '../orders/notify.js'
import { getCommissionConfig } from '../payments/commissionConfig.js'

const DAY_MS = 24 * 60 * 60_000

/**
 * Daily sweep — auto-blocks a Khata account once an `overdue` statement has
 * sat unpaid past `config/commission.creditOverdueGraceDays` (design brief
 * item 7). Suspension itself (not a limit change) is logged the same way a
 * limit change is, via a `limitChanges`-shaped entry with
 * `previousLimitPaise === newLimitPaise` (only `reason` differs) — kept in
 * the same subcollection rather than a parallel one, since "why is this
 * account's credit unusable right now" is one audit question either way.
 */
export const autoBlockOverdueCredit = onSchedule({ region: 'asia-south1', schedule: 'every 24 hours' }, async () => {
  const db = getFirestore()
  const now = Date.now()
  const commissionConfig = await getCommissionConfig()
  const graceMs = commissionConfig.creditOverdueGraceDays * DAY_MS

  const overdueSnapshot = await db.collection('creditStatements').where('status', '==', 'overdue').get()

  await Promise.all(
    overdueSnapshot.docs.map(async (doc) => {
      const statement = creditStatementSchema.parse({ id: doc.id, ...doc.data() })
      if (now < statement.dueDate + graceMs) return

      const accountRef = db.collection('creditAccounts').doc(statement.creditAccountId)
      const accountSnapshot = await accountRef.get()
      if (!accountSnapshot.exists) return
      const account = creditAccountSchema.parse({ id: accountSnapshot.id, ...accountSnapshot.data() })
      if (account.status !== 'active') return // Already suspended/closed.

      await accountRef.update({ status: 'suspended', updatedAt: now })
      await accountRef.collection('limitChanges').doc().set({
        creditAccountId: account.id,
        changedBy: 'system',
        previousLimitPaise: account.creditLimitPaise,
        newLimitPaise: account.creditLimitPaise,
        reason: `Auto-blocked: statement ${statement.id} overdue past the ${commissionConfig.creditOverdueGraceDays}-day grace period`,
        createdAt: now,
      })
      await queueNotificationDirect(db, { userId: account.buyerId, type: 'credit_blocked', language: 'en' })
    }),
  )
})
