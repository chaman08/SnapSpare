import { markNotificationReadRequestSchema } from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'

/** Marks a single notificationsQueue doc read — the in-app centre's per-item click handler. notificationsQueue has `allow write: if false` in firestore.rules, so this Admin SDK write is the only way the read/readAt fields ever change. */
export const markNotificationRead = onCall({ enforceAppCheck: true, region: 'asia-south1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required')
  const uid = request.auth.uid

  const parsed = markNotificationReadRequestSchema.safeParse(request.data)
  if (!parsed.success) throw new HttpsError('invalid-argument', 'A valid notificationId is required')

  const db = getFirestore()
  const ref = db.collection('notificationsQueue').doc(parsed.data.notificationId)
  const snapshot = await ref.get()
  if (!snapshot.exists) throw new HttpsError('not-found', 'notification_not_found')
  if (snapshot.data()?.userId !== uid) throw new HttpsError('permission-denied', 'not_your_notification')

  await ref.update({ read: true, readAt: Date.now() })
  return { success: true as const }
})
