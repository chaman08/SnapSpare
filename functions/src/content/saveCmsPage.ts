import { type SaveCmsPageResult, saveCmsPageRequestSchema } from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { isAdminRequest } from '../orders/authz.js'
import { writeAuditLog } from '../util/auditLog.js'
import { stripUndefined } from '../util/stripUndefined.js'

/** Content module (design brief item 10): create/update a policy/FAQ/SEO-landing page. `id` absent means create. */
export const saveCmsPage = onCall({ enforceAppCheck: true, region: 'asia-south1' }, async (request): Promise<SaveCmsPageResult> => {
  if (!request.auth || !isAdminRequest(request)) throw new HttpsError('permission-denied', 'admin_only')

  const parsed = saveCmsPageRequestSchema.safeParse(request.data)
  if (!parsed.success) throw new HttpsError('invalid-argument', 'Invalid request')
  const input = parsed.data

  const db = getFirestore()
  const now = Date.now()
  const isCreate = !input.id
  const ref = input.id ? db.collection('cmsPages').doc(input.id) : db.collection('cmsPages').doc()

  await ref.set(
    stripUndefined({
      slug: input.slug,
      type: input.type,
      title: input.title,
      body: input.body,
      metaDescription: input.metaDescription,
      status: input.status,
      updatedAt: now,
      ...(isCreate ? { createdAt: now } : {}),
    }),
    { merge: true },
  )

  await writeAuditLog({
    request,
    action: isCreate ? 'cmsPage.create' : 'cmsPage.update',
    targetType: 'cmsPages',
    targetId: ref.id,
    after: input,
  })

  return { id: ref.id }
})
