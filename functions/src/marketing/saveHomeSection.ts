import { type SaveHomeSectionResult, saveHomeSectionRequestSchema } from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { isAdminRequest } from '../orders/authz.js'
import { writeAuditLog } from '../util/auditLog.js'
import { stripUndefined } from '../util/stripUndefined.js'

/** Growth module's homepage-section builder (Phase 20 design brief item 1), one doc per rail — `id` absent means create. */
export const saveHomeSection = onCall({ enforceAppCheck: true, region: 'asia-south1' }, async (request): Promise<SaveHomeSectionResult> => {
  if (!request.auth || !isAdminRequest(request)) throw new HttpsError('permission-denied', 'admin_only')

  const parsed = saveHomeSectionRequestSchema.safeParse(request.data)
  if (!parsed.success) throw new HttpsError('invalid-argument', parsed.error.issues[0]?.message ?? 'invalid_request')
  const { id, ...input } = parsed.data

  const db = getFirestore()
  const now = Date.now()
  const isCreate = !id
  const ref = id ? db.collection('homeSections').doc(id) : db.collection('homeSections').doc()

  await ref.set(
    stripUndefined({
      ...input,
      updatedAt: now,
      ...(isCreate ? { createdAt: now } : {}),
    }),
    { merge: true },
  )

  await writeAuditLog({
    request,
    action: isCreate ? 'homeSection.create' : 'homeSection.update',
    targetType: 'homeSections',
    targetId: ref.id,
    after: input,
  })

  return { id: ref.id }
})
