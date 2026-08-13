import { type SaveBannerResult, saveBannerRequestSchema } from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { isAdminRequest } from '../orders/authz.js'
import { writeAuditLog } from '../util/auditLog.js'
import { stripUndefined } from '../util/stripUndefined.js'

/** Marketing module's banner/merchandising manager (design brief item 9), with slot scheduling (`slot` + `startAt`/`endAt`) — `id` absent means create. */
export const saveBanner = onCall({ enforceAppCheck: true, region: 'asia-south1' }, async (request): Promise<SaveBannerResult> => {
  if (!request.auth || !isAdminRequest(request)) throw new HttpsError('permission-denied', 'admin_only')

  const parsed = saveBannerRequestSchema.safeParse(request.data)
  if (!parsed.success) throw new HttpsError('invalid-argument', parsed.error.issues[0]?.message ?? 'invalid_request')
  const input = parsed.data

  const db = getFirestore()
  const now = Date.now()
  const isCreate = !input.id
  const ref = input.id ? db.collection('banners').doc(input.id) : db.collection('banners').doc()

  await ref.set(
    stripUndefined({
      slot: input.slot,
      imageUrl: input.imageUrl,
      linkUrl: input.linkUrl,
      title: input.title,
      sortOrder: input.sortOrder,
      startAt: input.startAt,
      endAt: input.endAt,
      status: input.status,
      updatedAt: now,
      ...(isCreate ? { createdAt: now } : {}),
    }),
    { merge: true },
  )

  await writeAuditLog({
    request,
    action: isCreate ? 'banner.create' : 'banner.update',
    targetType: 'banners',
    targetId: ref.id,
    after: input,
  })

  return { id: ref.id }
})
