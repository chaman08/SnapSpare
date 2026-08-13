import { type StartImpersonationResult, startImpersonationRequestSchema } from '@snapspare/shared'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { isAdminRequest } from '../orders/authz.js'
import { writeAuditLog } from '../util/auditLog.js'

/**
 * Users module impersonation (design brief item 11) — mints a Firebase Auth
 * custom token for `userId` so the admin's browser can sign in as them in a
 * fresh tab/session (the standard Firebase "sign in as this user" support
 * pattern). See startImpersonationRequestSchema's header comment for what
 * "consent-gated" means in this phase. Never usable against another admin
 * account, so a support impersonation session can't be used to escalate.
 */
export const startImpersonation = onCall(
  { enforceAppCheck: true, region: 'asia-south1' },
  async (request): Promise<StartImpersonationResult> => {
    if (!request.auth || !isAdminRequest(request)) throw new HttpsError('permission-denied', 'admin_only')

    const parsed = startImpersonationRequestSchema.safeParse(request.data)
    if (!parsed.success) throw new HttpsError('invalid-argument', 'Invalid request')
    const input = parsed.data

    const targetUser = await getAuth().getUser(input.userId)
    if (targetUser.customClaims?.role === 'admin') {
      throw new HttpsError('permission-denied', 'cannot_impersonate_admin')
    }

    const customToken = await getAuth().createCustomToken(input.userId)

    const db = getFirestore()
    const now = Date.now()
    const sessionRef = db.collection('impersonationSessions').doc()
    await sessionRef.set({
      adminId: request.auth.uid,
      targetUserId: input.userId,
      reason: input.reason,
      startedAt: now,
    })

    await writeAuditLog({
      request,
      action: 'user.startImpersonation',
      targetType: 'users',
      targetId: input.userId,
      note: input.reason,
    })

    return { customToken, sessionId: sessionRef.id }
  },
)
