import { type SaveBrandResult, saveBrandRequestSchema } from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { isAdminRequest } from '../orders/authz.js'
import { writeAuditLog } from '../util/auditLog.js'
import { stripUndefined } from '../util/stripUndefined.js'

/** Catalogue module (design brief item 3): create/update a brand master record. `id` absent means create. */
export const saveBrand = onCall({ enforceAppCheck: true, region: 'asia-south1' }, async (request): Promise<SaveBrandResult> => {
  if (!request.auth || !isAdminRequest(request)) throw new HttpsError('permission-denied', 'admin_only')

  const parsed = saveBrandRequestSchema.safeParse(request.data)
  if (!parsed.success) throw new HttpsError('invalid-argument', 'Invalid request')
  const input = parsed.data

  const db = getFirestore()
  const now = Date.now()
  const ref = input.id ? db.collection('brands').doc(input.id) : db.collection('brands').doc()
  const isCreate = !input.id

  const doc = stripUndefined({
    name: input.name,
    slug: input.slug,
    logoUrl: input.logoUrl,
    authorizedOnly: input.authorizedOnly,
    status: input.status,
    updatedAt: now,
    ...(isCreate ? { createdAt: now } : {}),
  })
  await ref.set(doc, { merge: true })

  await writeAuditLog({
    request,
    action: isCreate ? 'brand.create' : 'brand.update',
    targetType: 'brands',
    targetId: ref.id,
    after: input,
  })

  return { id: ref.id }
})
