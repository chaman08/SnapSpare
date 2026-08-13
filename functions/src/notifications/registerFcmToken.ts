import { registerFcmTokenRequestSchema } from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { enforceRateLimit } from '../util/rateLimit.js'

const MAX_TOKENS_PER_USER = 8

/** Registers (or refreshes) a web-push FCM token on `users/{uid}.fcmTokens`, deduping and capping the list so a user re-registering from the same browser repeatedly doesn't grow it unbounded. */
export const registerFcmToken = onCall({ enforceAppCheck: true, region: 'asia-south1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required')
  const uid = request.auth.uid

  const parsed = registerFcmTokenRequestSchema.safeParse(request.data)
  if (!parsed.success) throw new HttpsError('invalid-argument', 'A valid token is required')
  const { token } = parsed.data

  await enforceRateLimit(request, { name: 'registerFcmToken', perUidLimit: 20, perIpLimit: 40, windowMinutes: 60 })

  const db = getFirestore()
  const userRef = db.collection('users').doc(uid)

  await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(userRef)
    if (!snapshot.exists) throw new HttpsError('failed-precondition', 'user_profile_missing')

    const existing = (snapshot.data()?.fcmTokens as string[] | undefined) ?? []
    const next = [...existing.filter((t) => t !== token), token].slice(-MAX_TOKENS_PER_USER)
    tx.update(userRef, { fcmTokens: next, updatedAt: Date.now() })
  })

  return { success: true as const }
})
