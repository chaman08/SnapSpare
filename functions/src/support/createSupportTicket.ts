import {
  type CreateSupportTicketResult,
  configSchema,
  createSupportTicketRequestSchema,
  userSchema,
} from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { enforceRateLimit } from '../util/rateLimit.js'
import { stripUndefined } from '../util/stripUndefined.js'

const DEFAULT_SLA_HOURS = 48

/**
 * Phase 24 (launch readiness): the public contact form's write path.
 * Deliberately allows an unauthenticated call (`request.auth` may be null —
 * a guest filing a ticket before signing in, e.g. "I can't log in") as long
 * as at least one reply channel (email or phone) is supplied; a signed-in
 * caller still has to provide one too, since `userId` alone isn't a contact
 * channel anything here can message through (in-app notifications are
 * queued in addition to, not instead of, the email/phone reply). Rate-limited
 * on IP alone when there's no uid, exactly like any other pre-auth-reachable
 * callable (see rateLimit.ts's header comment).
 */
export const createSupportTicket = onCall(
  { enforceAppCheck: true, region: 'asia-south1' },
  async (request): Promise<CreateSupportTicketResult> => {
    const parsed = createSupportTicketRequestSchema.safeParse(request.data)
    if (!parsed.success) throw new HttpsError('invalid-argument', 'A valid support request is required')
    const input = parsed.data

    if (!input.contactEmail && !input.contactPhone) {
      throw new HttpsError('invalid-argument', 'contact_channel_required')
    }

    await enforceRateLimit(request, { name: 'createSupportTicket', perUidLimit: 10, perIpLimit: 15, windowMinutes: 60 })

    const db = getFirestore()
    const uid = request.auth?.uid

    let contactName = input.contactName
    if (uid) {
      const userSnapshot = await db.collection('users').doc(uid).get()
      const user = userSnapshot.exists ? userSchema.safeParse({ id: userSnapshot.id, ...userSnapshot.data() }) : undefined
      if (user?.success && !input.contactName.trim()) contactName = user.data.displayName ?? input.contactName
    }

    const configSnapshot = await db.collection('config').doc('app').get()
    const slaHours = configSnapshot.exists
      ? (configSchema.safeParse({ id: 'app', ...configSnapshot.data() }).data?.supportTicketSlaHours ?? DEFAULT_SLA_HOURS)
      : DEFAULT_SLA_HOURS

    const now = Date.now()
    const ref = db.collection('supportTickets').doc()
    await ref.set(
      stripUndefined({
        id: ref.id,
        userId: uid,
        contactName,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone,
        category: input.category,
        subject: input.subject,
        orderId: input.orderId,
        status: 'open' as const,
        messages: [{ authorRole: 'buyer' as const, authorUserId: uid, body: input.message, createdAt: now }],
        slaBreachAt: now + slaHours * 60 * 60_000,
        createdAt: now,
        updatedAt: now,
      }),
    )

    return { ticketId: ref.id, slaBreachAt: now + slaHours * 60 * 60_000 }
  },
)
