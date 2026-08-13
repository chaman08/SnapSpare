import {
  adminSaveCatalogPartRequestSchema,
  slugify,
  type AdminSaveCatalogPartResult,
} from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { isAdminRequest } from '../orders/authz.js'
import { writeAuditLog } from '../util/auditLog.js'
import { stripUndefined } from '../util/stripUndefined.js'
import { findDuplicateCatalogParts } from './duplicateDetection.js'

/**
 * Catalogue module (design brief item 3): create/update a master catalog
 * part. Duplicate-by-OEM-number detection (findDuplicateCatalogParts) blocks
 * a create whose `oemNumbers` overlap an already-active part unless
 * `allowDuplicate` is set — updates skip the check against themselves.
 */
export const adminSaveCatalogPart = onCall(
  { enforceAppCheck: true, region: 'asia-south1' },
  async (request): Promise<AdminSaveCatalogPartResult> => {
    if (!request.auth || !isAdminRequest(request)) throw new HttpsError('permission-denied', 'admin_only')

    const parsed = adminSaveCatalogPartRequestSchema.safeParse(request.data)
    if (!parsed.success) throw new HttpsError('invalid-argument', 'Invalid request')
    const input = parsed.data

    const db = getFirestore()
    const isCreate = !input.id

    const duplicateOfPartIds = input.oemNumbers.length > 0
      ? await findDuplicateCatalogParts(db, input.oemNumbers, input.id)
      : []

    if (isCreate && duplicateOfPartIds.length > 0 && !input.allowDuplicate) {
      throw new HttpsError('failed-precondition', 'duplicate_oem_numbers', { duplicateOfPartIds })
    }

    const now = Date.now()
    const ref = input.id ? db.collection('catalogParts').doc(input.id) : db.collection('catalogParts').doc()

    const doc = stripUndefined({
      partNumber: input.partNumber,
      partType: input.partType,
      categorySlug: input.categorySlug,
      subcategorySlug: input.subcategorySlug,
      name: input.name,
      description: input.description,
      brand: input.brand,
      oemNumbers: input.oemNumbers,
      crossRefNumbers: input.crossRefNumbers,
      hsnCode: input.hsnCode,
      gstRatePercent: input.gstRatePercent,
      countryOfOrigin: input.countryOfOrigin,
      status: input.status,
      updatedAt: now,
      // Slug is set once, at create, and never rewritten by a later name
      // edit — see catalogPart.ts's schema comment for why a published
      // product URL must never rot.
      ...(isCreate
        ? { slug: slugify(input.name), attributes: {}, images: [], fitmentSummary: { modelIds: [] }, createdAt: now }
        : {}),
    })
    await ref.set(doc, { merge: true })

    await writeAuditLog({
      request,
      action: isCreate ? 'catalogPart.create' : 'catalogPart.update',
      targetType: 'catalogParts',
      targetId: ref.id,
      after: input,
      note: duplicateOfPartIds.length > 0 ? `Saved despite ${duplicateOfPartIds.length} possible OEM duplicate(s)` : undefined,
    })

    return { id: ref.id, duplicateOfPartIds }
  },
)
