import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { processNotificationChannels } from './processNotificationChannels.js'
import { MSG91_API_KEY, RESEND_API_KEY, WHATSAPP_ACCESS_TOKEN } from './secrets.js'

/**
 * Fires once per freshly-queued notificationsQueue doc (every one of the 38+
 * call sites of queueNotification/queueNotificationDirect across
 * functions/src) and fans it out over its eligible external channels.
 * In-app display needs no dispatch — the doc itself is the in-app
 * notification (see schemas/notification.ts's read/readAt fields).
 */
export const dispatchNotification = onDocumentCreated(
  {
    document: 'notificationsQueue/{notificationId}',
    region: 'asia-south1',
    secrets: [WHATSAPP_ACCESS_TOKEN, MSG91_API_KEY, RESEND_API_KEY],
  },
  async (event) => {
    await processNotificationChannels(event.params.notificationId)
  },
)
