import { type ReorderHomeSectionsResult, reorderHomeSectionsRequestSchema } from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { isAdminRequest } from '../orders/authz.js'
import { writeAuditLog } from '../util/auditLog.js'

/** Growth module (Phase 20) — bulk-assigns `sortOrder` from array position, so the admin's drag/reorder UI can persist a whole new order in one call instead of one saveHomeSection per row. */
export const reorderHomeSections = onCall({ enforceAppCheck: true, region: 'asia-south1' }, async (request): Promise<ReorderHomeSectionsResult> => {
  if (!request.auth || !isAdminRequest(request)) throw new HttpsError('permission-denied', 'admin_only')

  const parsed = reorderHomeSectionsRequestSchema.safeParse(request.data)
  if (!parsed.success) throw new HttpsError('invalid-argument', parsed.error.issues[0]?.message ?? 'invalid_request')
  const { orderedIds } = parsed.data

  const db = getFirestore()
  const now = Date.now()
  const batch = db.batch()
  orderedIds.forEach((id, index) => {
    batch.set(db.collection('homeSections').doc(id), { sortOrder: index, updatedAt: now }, { merge: true })
  })
  await batch.commit()

  await writeAuditLog({
    request,
    action: 'homeSection.reorder',
    targetType: 'homeSections',
    targetId: 'reorder',
    after: { orderedIds },
  })

  return { updated: orderedIds.length }
})
