import { type SaveCategoryResult, saveCategoryRequestSchema } from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { isAdminRequest } from '../orders/authz.js'
import { writeAuditLog } from '../util/auditLog.js'
import { stripUndefined } from '../util/stripUndefined.js'

/** Catalogue module (design brief item 3): create/update a category/subcategory + its HSN/GST default mapping. `id` absent means create. */
export const saveCategory = onCall({ enforceAppCheck: true, region: 'asia-south1' }, async (request): Promise<SaveCategoryResult> => {
  if (!request.auth || !isAdminRequest(request)) throw new HttpsError('permission-denied', 'admin_only')

  const parsed = saveCategoryRequestSchema.safeParse(request.data)
  if (!parsed.success) throw new HttpsError('invalid-argument', 'Invalid request')
  const input = parsed.data

  const db = getFirestore()
  const now = Date.now()
  const ref = input.id ? db.collection('categories').doc(input.id) : db.collection('categories').doc()
  const isCreate = !input.id

  const doc = stripUndefined({
    slug: input.slug,
    name: input.name,
    parentSlug: input.parentSlug,
    defaultHsnCode: input.defaultHsnCode,
    defaultGstRatePercent: input.defaultGstRatePercent,
    status: input.status,
    updatedAt: now,
    ...(isCreate ? { createdAt: now } : {}),
  })
  await ref.set(doc, { merge: true })

  await writeAuditLog({
    request,
    action: isCreate ? 'category.create' : 'category.update',
    targetType: 'categories',
    targetId: ref.id,
    after: input,
  })

  return { id: ref.id }
})
