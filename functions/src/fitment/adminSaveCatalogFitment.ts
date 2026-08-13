import {
  adminSaveCatalogFitmentRequestSchema,
  type AdminSaveCatalogFitmentResult,
} from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { isAdminRequest } from '../orders/authz.js'
import { writeAuditLog } from '../util/auditLog.js'
import { stripUndefined } from '../util/stripUndefined.js'
import { findConflictingFitments } from './fitmentConflictDetection.js'

/** Fitment workbench (design brief item 4): create/edit/verify one catalogFitments row. */
export const adminSaveCatalogFitment = onCall(
  { enforceAppCheck: true, region: 'asia-south1' },
  async (request): Promise<AdminSaveCatalogFitmentResult> => {
    if (!request.auth || !isAdminRequest(request)) throw new HttpsError('permission-denied', 'admin_only')
    const adminUid = request.auth.uid

    const parsed = adminSaveCatalogFitmentRequestSchema.safeParse(request.data)
    if (!parsed.success) throw new HttpsError('invalid-argument', 'Invalid request')
    const input = parsed.data

    const db = getFirestore()
    const isCreate = !input.id

    const conflictingFitmentIds = await findConflictingFitments(db, input, input.id)
    if (isCreate && conflictingFitmentIds.length > 0 && !input.allowConflict) {
      throw new HttpsError('failed-precondition', 'conflicting_fitment', { conflictingFitmentIds })
    }

    const now = Date.now()
    const ref = input.id ? db.collection('catalogFitments').doc(input.id) : db.collection('catalogFitments').doc()

    const doc = stripUndefined({
      partId: input.partId,
      makeId: input.makeId,
      modelId: input.modelId,
      variantId: input.variantId,
      fuelTypes: input.fuelTypes,
      yearFrom: input.yearFrom,
      yearTo: input.yearTo,
      notes: input.notes,
      updatedAt: now,
      ...(input.verify ? { verifiedBy: adminUid, verifiedAt: now } : {}),
      ...(isCreate ? { createdAt: now } : {}),
    })
    await ref.set(doc, { merge: true })

    await writeAuditLog({
      request,
      action: isCreate ? 'catalogFitment.create' : 'catalogFitment.update',
      targetType: 'catalogFitments',
      targetId: ref.id,
      after: input,
      note: conflictingFitmentIds.length > 0 ? `Saved despite ${conflictingFitmentIds.length} conflicting row(s)` : undefined,
    })

    return { id: ref.id, conflictingFitmentIds }
  },
)
