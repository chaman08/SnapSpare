import {
  type RespondToSupportTicketResult,
  respondToSupportTicketRequestSchema,
  supportTicketSchema,
} from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { isAdminRequest } from '../orders/authz.js'
import { queueNotificationDirect } from '../orders/notify.js'
import { resolveUserLanguage } from '../seller/notifyLanguage.js'

/**
 * Admin/support-staff reply on an open ticket — appends a message and moves
 * `open`/`resolved`/`closed` back to `in_progress` (a reply reopens a
 * resolved/closed ticket rather than silently attaching to a dead thread;
 * `resolveSupportTicket.ts` is the only way to close one again). No
 * "support staff" role distinct from admin exists yet in this codebase (see
 * README's Phase 24 notes) — every reply is admin-only for now.
 */
export const respondToSupportTicket = onCall(
  { enforceAppCheck: true, region: 'asia-south1' },
  async (request): Promise<RespondToSupportTicketResult> => {
    if (!request.auth || !isAdminRequest(request)) throw new HttpsError('permission-denied', 'admin_only')
    const adminUid = request.auth.uid

    const parsed = respondToSupportTicketRequestSchema.safeParse(request.data)
    if (!parsed.success) throw new HttpsError('invalid-argument', 'A valid reply is required')
    const input = parsed.data

    const db = getFirestore()
    const ref = db.collection('supportTickets').doc(input.ticketId)
    const snapshot = await ref.get()
    if (!snapshot.exists) throw new HttpsError('not-found', 'ticket_not_found')
    const ticket = supportTicketSchema.parse({ id: snapshot.id, ...snapshot.data() })

    const now = Date.now()
    await ref.update({
      messages: [...ticket.messages, { authorRole: 'admin', authorUserId: adminUid, body: input.body, createdAt: now }],
      status: 'in_progress',
      assignedTo: ticket.assignedTo ?? adminUid,
      updatedAt: now,
    })

    if (ticket.userId) {
      await queueNotificationDirect(db, {
        userId: ticket.userId,
        type: 'support_ticket_replied',
        language: await resolveUserLanguage(db, ticket.userId),
        data: { supportTicketId: ticket.id },
      })
    }
    // Guest (no userId) tickets have no in-app inbox to notify — the support
    // agent replies to contactEmail/contactPhone directly outside this app,
    // same limitation noted on createSupportTicket.ts.

    return { ticketId: ticket.id, status: 'in_progress' }
  },
)
