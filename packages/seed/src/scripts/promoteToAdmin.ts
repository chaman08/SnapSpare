import { userSchema } from '@snapspare/shared'
import { getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'

/**
 * One-off bootstrap script: grants a user the `admin` custom claim + mirrors
 * it into their Firestore profile, exactly like functions/src/auth/setUserRole.ts
 * does — but callable outside the app, since setUserRole itself requires an
 * existing admin caller (chicken-and-egg for the very first admin on a
 * project). Point it at a real project via GOOGLE_APPLICATION_CREDENTIALS /
 * gcloud application default credentials + GCLOUD_PROJECT, or at the
 * emulator via FIRESTORE_EMULATOR_HOST + FIREBASE_AUTH_EMULATOR_HOST.
 *
 * Run with: pnpm --filter @snapspare/seed promote-admin <uid>
 */

async function main() {
  const uid = process.argv[2]
  if (!uid) {
    throw new Error('Usage: pnpm --filter @snapspare/seed promote-admin <uid>')
  }

  const projectId = process.env.GCLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT
  if (!projectId) {
    throw new Error('GCLOUD_PROJECT is required (the Firebase project id, e.g. snapspare-edcc1)')
  }

  if (getApps().length === 0) {
    initializeApp({ projectId })
  }

  const auth = getAuth()
  const db = getFirestore()
  db.settings({ ignoreUndefinedProperties: true })

  const user = await auth.getUser(uid)
  console.log(`Found user ${uid} (${user.phoneNumber ?? user.email ?? 'no phone/email'})`)

  await auth.setCustomUserClaims(uid, { role: 'admin' })
  console.log('Set custom claim { role: "admin" }')

  const userRef = db.collection('users').doc(uid)
  const existing = await userRef.get()
  const now = Date.now()

  if (existing.exists) {
    await userRef.update({
      roles: FieldValue.arrayUnion('admin'),
      primaryRole: 'admin',
      updatedAt: now,
    })
    console.log('Updated existing users/{uid} Firestore profile')
  } else {
    // No profile doc yet — likely because Identity Platform blocking
    // functions (onUserCreate.ts) aren't enabled on this project. Build a
    // minimal valid one the same way onUserCreate.ts / seedAdmin.ts do.
    const { id: _id, ...profile } = userSchema.parse({
      id: uid,
      phone: user.phoneNumber?.replace(/^\+91/, '') || undefined,
      displayName: user.displayName || 'Admin',
      email: user.email || undefined,
      photoUrl: user.photoURL || undefined,
      roles: ['admin'],
      primaryRole: 'admin',
      fcmTokens: [],
      preferredLanguage: 'en',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    })
    await userRef.set(profile)
    console.log('Created users/{uid} Firestore profile (none existed)')
  }

  console.log('\nDone. The user must sign out/in (or call getIdToken(true)) for the new claim to take effect.')
}

main().catch((error: unknown) => {
  console.error('promoteToAdmin failed:', error)
  process.exitCode = 1
})
