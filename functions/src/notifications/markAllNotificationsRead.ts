import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'

const MAX_BATCH = 300

/** Marks the caller's most recent unread notifications read in one batch — powers the notification centre's "mark all read" action. Bounded to MAX_BATCH so a very long unread backlog doesn't blow past Firestore's 500-write batch limit. */
export const markAllNotificationsRead = onCall({ enforceAppCheck: true, region: 'asia-south1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required')
  const uid = request.auth.uid

  const db = getFirestore()
  const snapshot = await db
    .collection('notificationsQueue')
    .where('userId', '==', uid)
    .where('read', '==', false)
    .orderBy('createdAt', 'desc')
    .limit(MAX_BATCH)
    .get()

  if (snapshot.empty) return { updated: 0 }

  const now = Date.now()
  const batch = db.batch()
  snapshot.docs.forEach((doc) => batch.update(doc.ref, { read: true, readAt: now }))
  await batch.commit()

  return { updated: snapshot.size }
})
