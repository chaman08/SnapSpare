import { getFirestore } from 'firebase-admin/firestore'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { processNotificationChannels } from './processNotificationChannels.js'
import { MSG91_API_KEY, RESEND_API_KEY, WHATSAPP_ACCESS_TOKEN } from './secrets.js'

/**
 * Retry sweep for channels that failed on their first dispatch attempt —
 * dispatchNotification.ts only fires once per doc creation, so anything
 * left with a pending per-channel retry (see processNotificationChannels.ts's
 * exponential backoff) needs a separate driver. Queries the top-level
 * `nextRetryAt` rollup field rather than the `deliveries` map, since
 * Firestore can't range-query into a map's dynamic keys. Same 5-attempt
 * cap and dead-letter behaviour as the initial dispatch, since both paths
 * share processNotificationChannels.ts.
 */
export const retryFailedNotifications = onSchedule(
  {
    region: 'asia-south1',
    schedule: 'every 5 minutes',
    secrets: [WHATSAPP_ACCESS_TOKEN, MSG91_API_KEY, RESEND_API_KEY],
  },
  async () => {
    const db = getFirestore()
    const now = Date.now()
    const dueSnapshot = await db.collection('notificationsQueue').where('nextRetryAt', '<=', now).limit(200).get()

    await Promise.all(dueSnapshot.docs.map((doc) => processNotificationChannels(doc.id)))
  },
)
