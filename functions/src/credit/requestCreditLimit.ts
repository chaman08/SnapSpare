import {
  type RequestCreditLimitResult,
  requestCreditLimitRequestSchema,
  userSchema,
} from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { queueNotificationDirect } from '../orders/notify.js'
import { enforceRateLimit } from '../util/rateLimit.js'

/**
 * A verified garage's ask for a Khata credit limit — design brief item 7's
 * "clear admin approval flow for granting limits" starts here. Gated on
 * `buyerType === 'garage' && garageVerifiedAt` (admin-set only, see
 * schemas/user.ts), never on the buyer's own say-so. Resolved only by
 * approveCreditLimit.ts.
 */
export const requestCreditLimit = onCall(
  { enforceAppCheck: true, region: 'asia-south1' },
  async (request): Promise<RequestCreditLimitResult> => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required')
    const buyerId = request.auth.uid

    const parsed = requestCreditLimitRequestSchema.safeParse(request.data)
    if (!parsed.success) throw new HttpsError('invalid-argument', 'A valid requestedLimitPaise is required')

    await enforceRateLimit(request, { name: 'requestCreditLimit', perUidLimit: 5, perIpLimit: 10, windowMinutes: 1440 })

    const db = getFirestore()
    const buyerSnapshot = await db.collection('users').doc(buyerId).get()
    if (!buyerSnapshot.exists) throw new HttpsError('failed-precondition', 'buyer_profile_missing')
    const buyer = userSchema.parse({ id: buyerSnapshot.id, ...buyerSnapshot.data() })

    if (buyer.buyerType !== 'garage' || !buyer.garageVerifiedAt) {
      throw new HttpsError('failed-precondition', 'garage_not_verified')
    }

    const now = Date.now()
    const ref = db.collection('creditLimitRequests').doc()
    await ref.set({
      buyerId,
      requestedLimitPaise: parsed.data.requestedLimitPaise,
      reason: parsed.data.reason,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    })

    const buyerLanguage = buyer.preferredLanguage === 'hi' ? 'hi' : 'en'
    await queueNotificationDirect(db, {
      userId: buyerId,
      type: 'credit_limit_requested',
      language: buyerLanguage,
    })

    return { creditLimitRequestId: ref.id }
  },
)
