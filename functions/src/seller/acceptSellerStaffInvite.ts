import { type AcceptSellerStaffInviteResult, sellerStaffSchema } from '@snapspare/shared'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { queueNotificationDirect } from '../orders/notify.js'
import { resolveUserLanguage } from './notifyLanguage.js'

/**
 * Called by a user right after they phone-OTP sign in, to claim any pending
 * staff invite addressed to their number. Matches on the Auth token's
 * `phone_number` claim (E.164, e.g. "+919876543210") against the India-only
 * 10-digit `sellerStaff.phone` field the same way toE164India/phoneAuth.ts's
 * client-side signup does it, just in reverse.
 */
export const acceptSellerStaffInvite = onCall(
  { enforceAppCheck: true, region: 'asia-south1' },
  async (request): Promise<AcceptSellerStaffInviteResult> => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required')
    const uid = request.auth.uid
    const phoneNumber = request.auth.token.phone_number
    if (typeof phoneNumber !== 'string' || !phoneNumber.startsWith('+91')) {
      throw new HttpsError('failed-precondition', 'phone_signin_required')
    }
    const localPhone = phoneNumber.slice(3)

    const db = getFirestore()
    const pending = await db
      .collection('sellerStaff')
      .where('phone', '==', localPhone)
      .where('status', '==', 'invited')
      .limit(1)
      .get()
    if (pending.empty) throw new HttpsError('not-found', 'no_pending_invite')

    const doc = pending.docs[0]
    if (!doc) throw new HttpsError('not-found', 'no_pending_invite')
    const invite = sellerStaffSchema.parse({ id: doc.id, ...doc.data() })

    const now = Date.now()
    await doc.ref.update({ userId: uid, status: 'active', updatedAt: now })

    await getAuth().setCustomUserClaims(uid, {
      role: 'seller',
      sellerId: invite.sellerId,
      staffRole: invite.role,
      permissions: invite.permissions,
    })

    await queueNotificationDirect(db, {
      userId: uid,
      type: 'seller_staff_invited',
      language: await resolveUserLanguage(db, uid),
    })

    return { sellerId: invite.sellerId, role: invite.role }
  },
)
