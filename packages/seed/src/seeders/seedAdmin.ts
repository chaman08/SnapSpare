import { userSchema } from '@snapspare/shared'
import { authAdmin, db } from '../lib/firebaseAdmin.js'

/** One admin account, purely so the freshly-seeded emulator has someone who can exercise the isAdmin() rule paths right away. */
export async function seedAdmin(): Promise<void> {
  const now = Date.now()
  const adminUid = 'admin-seed'

  await authAdmin.createUser({
    uid: adminUid,
    phoneNumber: '+919999900000',
    displayName: 'SnapSpare Admin',
  })
  await authAdmin.setCustomUserClaims(adminUid, { role: 'admin' })

  const { id: _id, ...userDoc } = userSchema.parse({
    id: adminUid,
    phone: '9999900000',
    displayName: 'SnapSpare Admin',
    roles: ['admin'],
    primaryRole: 'admin',
    fcmTokens: [],
    preferredLanguage: 'en',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  })
  await db.collection('users').doc(adminUid).set(userDoc)

  console.log('  admin: 1 (admin-seed)')
}
