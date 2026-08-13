import { notificationPreferencesSchema, updateNotificationPreferencesRequestSchema } from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'

const DEFAULT_CHANNELS = { push: true, sms: true, whatsapp: true, email: true }

/** Upserts the caller's canonical notificationPreferences/{uid} doc — see schemas/notificationPreferences.ts's doc comment on why this supersedes (rather than replaces) the older seller-only embedded preferences field. */
export const updateNotificationPreferences = onCall({ enforceAppCheck: true, region: 'asia-south1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required')
  const uid = request.auth.uid

  const parsed = updateNotificationPreferencesRequestSchema.safeParse(request.data)
  if (!parsed.success) throw new HttpsError('invalid-argument', 'Invalid preferences payload')
  const input = parsed.data

  const db = getFirestore()
  const ref = db.collection('notificationPreferences').doc(uid)
  const now = Date.now()

  const existingSnapshot = await ref.get()
  const existing = existingSnapshot.exists
    ? notificationPreferencesSchema.safeParse({ id: uid, userId: uid, ...existingSnapshot.data() })
    : undefined
  const existingChannels = existing?.success ? existing.data.channels : DEFAULT_CHANNELS
  const existingOptOut = existing?.success ? existing.data.marketingOptOut : false

  const next = notificationPreferencesSchema.parse({
    id: uid,
    userId: uid,
    channels: { ...existingChannels, ...input.channels },
    marketingOptOut: input.marketingOptOut ?? existingOptOut,
    updatedAt: now,
  })
  const { id: _id, ...doc } = next

  await ref.set(doc)
  return { success: true as const }
})
