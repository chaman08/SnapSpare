import {
  commissionConfigSchema,
  type UpdateCommissionConfigResult,
  updateCommissionConfigRequestSchema,
} from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { isAdminRequest } from '../orders/authz.js'
import { writeAuditLog } from '../util/auditLog.js'
import { stripUndefined } from '../util/stripUndefined.js'

/**
 * Finance module's commission-plan editor. `config/commission` is written
 * directly by the client today only in the sense that firestore.rules
 * allows `isAdmin()` there (Phase 14 precedent) — but going through this
 * callable instead is what gives the change an audit-log entry, so the
 * admin UI always calls this rather than writing the doc directly.
 */
export const updateCommissionConfig = onCall(
  { enforceAppCheck: true, region: 'asia-south1' },
  async (request): Promise<UpdateCommissionConfigResult> => {
    if (!request.auth || !isAdminRequest(request)) throw new HttpsError('permission-denied', 'admin_only')

    const parsed = updateCommissionConfigRequestSchema.safeParse(request.data)
    if (!parsed.success) throw new HttpsError('invalid-argument', 'Invalid request')
    const input = parsed.data

    const db = getFirestore()
    const ref = db.collection('config').doc('commission')
    const snapshot = await ref.get()
    const before = snapshot.exists ? commissionConfigSchema.safeParse({ id: snapshot.id, ...snapshot.data() }) : undefined

    const now = Date.now()
    await ref.set(stripUndefined({ ...input, updatedAt: now }), { merge: true })

    await writeAuditLog({
      request,
      action: 'commissionConfig.update',
      targetType: 'config',
      targetId: 'commission',
      before: before?.success ? before.data : undefined,
      after: input,
    })

    return { ok: true }
  },
)
