import { userSchema } from '@snapspare/shared'
import type { Firestore } from 'firebase-admin/firestore'
import type { NotificationLanguage } from '../orders/notify.js'

/** Shared by every seller/* callable that queues a notification — looks up the target user's preferredLanguage the same way requestCreditLimit.ts does inline. Falls back to 'en' if the profile is missing or unparsable. */
export async function resolveUserLanguage(db: Firestore, userId: string): Promise<NotificationLanguage> {
  const snapshot = await db.collection('users').doc(userId).get()
  if (!snapshot.exists) return 'en'
  const parsed = userSchema.safeParse({ id: snapshot.id, ...snapshot.data() })
  return parsed.success && parsed.data.preferredLanguage === 'hi' ? 'hi' : 'en'
}
