import { disputeSchema } from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { queueNotificationDirect } from '../orders/notify.js'

const WARNING_LEAD_MS = 6 * 60 * 60_000

/**
 * Warns every admin ahead of a dispute's SLA deadline (design brief item 7's
 * "SLA clock") — fires once per dispute, `slaWarningSentAt` gating the
 * repeat exactly like sendSlaBreachWarnings.ts's subOrder equivalent. Unlike
 * every other Phase 18 notification (which targets whichever buyer/seller
 * is a direct participant), this is the one case that pages every admin
 * directly — a breaching dispute has no single "owner" to notify, and
 * admins don't otherwise get pushed toward the /admin/disputes queue.
 */
export const sendDisputeSlaBreachWarnings = onSchedule({ region: 'asia-south1', schedule: 'every 6 hours' }, async () => {
  const db = getFirestore()
  const now = Date.now()

  const [disputeSnapshot, adminSnapshot] = await Promise.all([
    db
      .collection('disputes')
      .where('status', 'in', ['open', 'under_review'])
      .where('slaBreachAt', '<=', now + WARNING_LEAD_MS)
      .limit(100)
      .get(),
    db.collection('users').where('roles', 'array-contains', 'admin').get(),
  ])

  const adminUserIds = adminSnapshot.docs.map((doc) => doc.id)
  if (adminUserIds.length === 0) return

  await Promise.all(
    disputeSnapshot.docs.map(async (doc) => {
      const dispute = disputeSchema.safeParse({ id: doc.id, ...doc.data() })
      if (!dispute.success || dispute.data.slaWarningSentAt) return

      await doc.ref.update({ slaWarningSentAt: now })
      await Promise.all(
        adminUserIds.map((adminUserId) =>
          queueNotificationDirect(db, {
            userId: adminUserId,
            type: 'dispute_sla_breach_warning',
            language: 'en',
            orderId: dispute.data.orderId,
            subOrderId: dispute.data.subOrderId,
            disputeId: dispute.data.id,
          }),
        ),
      )
    }),
  )
})
