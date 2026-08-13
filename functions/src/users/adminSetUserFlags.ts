import { adminSetUserFlagsRequestSchema, type AdminSetUserFlagsResult } from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { isAdminRequest } from '../orders/authz.js'
import { writeAuditLog } from '../util/auditLog.js'
import { stripUndefined } from '../util/stripUndefined.js'

/** Users module (design brief item 11): manual override for codAbuseFlag/returnAbuseFlag — see adminSetUserFlagsRequestSchema's header comment. */
export const adminSetUserFlags = onCall(
  { enforceAppCheck: true, region: 'asia-south1' },
  async (request): Promise<AdminSetUserFlagsResult> => {
    if (!request.auth || !isAdminRequest(request)) throw new HttpsError('permission-denied', 'admin_only')

    const parsed = adminSetUserFlagsRequestSchema.safeParse(request.data)
    if (!parsed.success) throw new HttpsError('invalid-argument', 'Invalid request')
    const input = parsed.data

    const db = getFirestore()
    const ref = db.collection('users').doc(input.userId)
    const snapshot = await ref.get()
    if (!snapshot.exists) throw new HttpsError('not-found', 'user_not_found')

    const update = stripUndefined({
      codAbuseFlag: input.codAbuseFlag,
      returnAbuseFlag: input.returnAbuseFlag,
      updatedAt: Date.now(),
    })
    await ref.update(update)

    await writeAuditLog({
      request,
      action: 'user.setFlags',
      targetType: 'users',
      targetId: input.userId,
      before: { codAbuseFlag: snapshot.data()?.codAbuseFlag, returnAbuseFlag: snapshot.data()?.returnAbuseFlag },
      after: { codAbuseFlag: input.codAbuseFlag, returnAbuseFlag: input.returnAbuseFlag },
    })

    return { ok: true }
  },
)
