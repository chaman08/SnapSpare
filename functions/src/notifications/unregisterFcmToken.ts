import { unregisterFcmTokenRequestSchema } from '@snapspare/shared'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'

/** Removes a single web-push token from `users/{uid}.fcmTokens` — called on sign-out or when the browser reports the permission was revoked. */
export const unregisterFcmToken = onCall({ enforceAppCheck: true, region: 'asia-south1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required')
  const uid = request.auth.uid

  const parsed = unregisterFcmTokenRequestSchema.safeParse(request.data)
  if (!parsed.success) throw new HttpsError('invalid-argument', 'A valid token is required')

  await getFirestore()
    .collection('users')
    .doc(uid)
    .update({ fcmTokens: FieldValue.arrayRemove(parsed.data.token), updatedAt: Date.now() })

  return { success: true as const }
})
