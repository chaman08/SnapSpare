import {
  type ResolveSupportTicketResult,
  resolveSupportTicketRequestSchema,
  supportTicketSchema,
} from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { isAdminRequest } from '../orders/authz.js'
import { queueNotificationDirect } from '../orders/notify.js'
import { resolveUserLanguage } from '../seller/notifyLanguage.js'
import { stripUndefined } from '../util/stripUndefined.js'

/** Admin closes out a ticket — `resolved` (issue fixed) or `closed` (no further action, e.g. duplicate/spam). Both stop counting against the SLA the same way (only `open`/`in_progress` tickets are swept by sendSupportTicketSlaBreachWarnings.ts). */
export const resolveSupportTicket = onCall(
  { enforceAppCheck: true, region: 'asia-south1' },
  async (request): Promise<ResolveSupportTicketResult> => {
    if (!request.auth || !isAdminRequest(request)) throw new HttpsError('permission-denied', 'admin_only')
    const adminUid = request.auth.uid

    const parsed = resolveSupportTicketRequestSchema.safeParse(request.data)
    if (!parsed.success) throw new HttpsError('invalid-argument', 'Invalid request')
    const input = parsed.data

    const db = getFirestore()
    const ref = db.collection('supportTickets').doc(input.ticketId)
    const snapshot = await ref.get()
    if (!snapshot.exists) throw new HttpsError('not-found', 'ticket_not_found')
    const ticket = supportTicketSchema.parse({ id: snapshot.id, ...snapshot.data() })

    const now = Date.now()
    const messages = input.note
      ? [...ticket.messages, { authorRole: 'admin' as const, authorUserId: adminUid, body: input.note, createdAt: now }]
      : ticket.messages

    await ref.update(
      stripUndefined({
        messages,
        status: input.status,
        resolvedAt: now,
        updatedAt: now,
      }),
    )

    if (ticket.userId && input.status === 'resolved') {
      await queueNotificationDirect(db, {
        userId: ticket.userId,
        type: 'support_ticket_resolved',
        language: await resolveUserLanguage(db, ticket.userId),
        data: { supportTicketId: ticket.id },
      })
    }

    return { ticketId: ticket.id, status: input.status }
  },
)
