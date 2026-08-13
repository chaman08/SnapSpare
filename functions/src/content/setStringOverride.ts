import { type SetStringOverrideResult, setStringOverrideRequestSchema } from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { isAdminRequest } from '../orders/authz.js'
import { writeAuditLog } from '../util/auditLog.js'

/** Content module (design brief item 10): set (or clear, by passing empty strings) one i18next key's admin override. The doc id is the key itself. */
export const setStringOverride = onCall(
  { enforceAppCheck: true, region: 'asia-south1' },
  async (request): Promise<SetStringOverrideResult> => {
    if (!request.auth || !isAdminRequest(request)) throw new HttpsError('permission-denied', 'admin_only')

    const parsed = setStringOverrideRequestSchema.safeParse(request.data)
    if (!parsed.success) throw new HttpsError('invalid-argument', 'Invalid request')
    const input = parsed.data

    const db = getFirestore()
    const ref = db.collection('stringOverrides').doc(input.key)
    const before = await ref.get()
    const now = Date.now()

    await ref.set({ key: input.key, en: input.en, hi: input.hi, updatedAt: now })

    await writeAuditLog({
      request,
      action: 'stringOverride.set',
      targetType: 'stringOverrides',
      targetId: input.key,
      before: before.exists ? before.data() : undefined,
      after: input,
    })

    return { key: input.key }
  },
)
