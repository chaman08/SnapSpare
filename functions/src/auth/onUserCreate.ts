import { userSchema } from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { beforeUserCreated } from 'firebase-functions/v2/identity'

/**
 * Runs before a new Firebase Auth user is actually created. Seeds their
 * users/{uid} Firestore document with role 'buyer' and buyerType 'retail' so
 * the app never has to handle a signed-in user with no profile document.
 *
 * Requires Identity Platform "blocking functions" to be enabled for this
 * project in the Firebase console (Authentication > Settings > Blocking
 * functions) — this cannot be turned on from code.
 */
export const onUserCreate = beforeUserCreated({ region: 'asia-south1' }, async (event) => {
  const authUser = event.data
  if (!authUser) return undefined

  const now = Date.now()
  const phone = authUser.phoneNumber?.replace(/^\+91/, '')

  const { id: _id, ...profile } = userSchema.parse({
    id: authUser.uid,
    phone: phone && /^[6-9][0-9]{9}$/.test(phone) ? phone : undefined,
    displayName: authUser.displayName || 'New user',
    email: authUser.email || undefined,
    photoUrl: authUser.photoURL || undefined,
    roles: ['buyer'],
    primaryRole: 'buyer',
    buyerType: 'retail',
    fcmTokens: [],
    preferredLanguage: 'en',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  })

  await getFirestore().collection('users').doc(authUser.uid).set(profile)

  // Every user gets an explicit 'buyer' role claim from the moment they
  // exist — seller/admin are granted later via setUserRole / seller approval.
  return { customClaims: { role: 'buyer' } }
})
