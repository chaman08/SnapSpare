import { reviewBrandAuthorizationRequestSchema } from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { isAdminRequest } from '../orders/authz.js'
import { queueNotificationDirect } from '../orders/notify.js'
import { resolveUserLanguage } from '../seller/notifyLanguage.js'
import { writeAuditLog } from '../util/auditLog.js'

/** Admin approve/reject of a submitted brand-authorization document — approval is what onBrandAuthorizationWrite.ts reacts to in order to award the "Genuine part" badge on matching listings. */
export const reviewBrandAuthorization = onCall({ enforceAppCheck: true, region: 'asia-south1' }, async (request): Promise<{ status: string }> => {
  if (!request.auth || !isAdminRequest(request)) throw new HttpsError('permission-denied', 'admin_only')
  const adminUid = request.auth.uid

  const parsed = reviewBrandAuthorizationRequestSchema.safeParse(request.data)
  if (!parsed.success) throw new HttpsError('invalid-argument', 'A valid decision is required')
  const input = parsed.data

  const db = getFirestore()
  const ref = db.collection('brandAuthorizations').doc(input.id)
  const snapshot = await ref.get()
  if (!snapshot.exists) throw new HttpsError('not-found', 'authorization_not_found')
  const authorization = snapshot.data() as { sellerId?: string }

  const now = Date.now()
  if (input.decision === 'verified') {
    await ref.update({ status: 'verified', verifiedAt: now, verifiedBy: adminUid, updatedAt: now })
  } else {
    await ref.update({ status: 'rejected', rejectedReason: input.rejectedReason, updatedAt: now })
  }

  if (authorization.sellerId) {
    const sellerSnapshot = await db.collection('sellers').doc(authorization.sellerId).get()
    const ownerUserId = sellerSnapshot.exists ? (sellerSnapshot.data()?.ownerUserId as string | undefined) : undefined
    if (ownerUserId) {
      await queueNotificationDirect(db, {
        userId: ownerUserId,
        type: 'brand_authorization_reviewed',
        language: await resolveUserLanguage(db, ownerUserId),
      })
    }
  }

  await writeAuditLog({
    request,
    action: 'brandAuthorization.review',
    targetType: 'brandAuthorizations',
    targetId: input.id,
    after: { status: input.decision },
    note: input.decision === 'rejected' ? input.rejectedReason : undefined,
  })

  return { status: input.decision }
})
