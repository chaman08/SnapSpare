import { supportTicketSchema } from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { queueNotificationDirect } from '../orders/notify.js'

const WARNING_LEAD_MS = 6 * 60 * 60_000

/**
 * Support module's SLA clock (design brief item 2's "SLA policy"). Same
 * shape as sendDisputeSlaBreachWarnings.ts: warns every admin once per
 * ticket, `slaWarningSentAt` gating the repeat, 6-hour sweep so a ticket
 * never breaches its SLA silently with nobody paged.
 */
export const sendSupportTicketSlaBreachWarnings = onSchedule({ region: 'asia-south1', schedule: 'every 6 hours' }, async () => {
  const db = getFirestore()
  const now = Date.now()

  const [ticketSnapshot, adminSnapshot] = await Promise.all([
    db
      .collection('supportTickets')
      .where('status', 'in', ['open', 'in_progress'])
      .where('slaBreachAt', '<=', now + WARNING_LEAD_MS)
      .limit(100)
      .get(),
    db.collection('users').where('roles', 'array-contains', 'admin').get(),
  ])

  const adminUserIds = adminSnapshot.docs.map((doc) => doc.id)
  if (adminUserIds.length === 0) return

  await Promise.all(
    ticketSnapshot.docs.map(async (doc) => {
      const ticket = supportTicketSchema.safeParse({ id: doc.id, ...doc.data() })
      if (!ticket.success || ticket.data.slaWarningSentAt) return

      await doc.ref.update({ slaWarningSentAt: now })
      await Promise.all(
        adminUserIds.map((adminUserId) =>
          queueNotificationDirect(db, {
            userId: adminUserId,
            type: 'support_ticket_sla_breach_warning',
            language: 'en',
            data: { supportTicketId: ticket.data.id },
          }),
        ),
      )
    }),
  )
})
