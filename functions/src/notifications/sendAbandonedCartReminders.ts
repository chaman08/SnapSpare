import { cartSchema } from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { queueNotificationDirect } from '../orders/notify.js'
import { resolveUserLanguage } from '../seller/notifyLanguage.js'

const MIN_IDLE_MS = 2 * 60 * 60_000
const MAX_IDLE_MS = 6 * 60 * 60_000

/**
 * Reminds a buyer about a non-empty cart that's gone quiet for 2-6h —
 * fires once per idle period (`abandonedReminderSentAt` gates the repeat;
 * cleared implicitly whenever the cart is next touched since that bumps
 * `updatedAt` out of this window). The upper 6h bound keeps this from
 * re-scanning carts abandoned long ago on every run.
 */
export const sendAbandonedCartReminders = onSchedule({ region: 'asia-south1', schedule: 'every 1 hours' }, async () => {
  const db = getFirestore()
  const now = Date.now()

  const snapshot = await db
    .collection('carts')
    .where('updatedAt', '<=', now - MIN_IDLE_MS)
    .where('updatedAt', '>=', now - MAX_IDLE_MS)
    .limit(200)
    .get()

  await Promise.all(
    snapshot.docs.map(async (doc) => {
      const cart = cartSchema.safeParse({ id: doc.id, ...doc.data() })
      if (!cart.success || cart.data.abandonedReminderSentAt || cart.data.sellerGroups.length === 0) return

      await doc.ref.update({ abandonedReminderSentAt: now })
      await queueNotificationDirect(db, {
        userId: cart.data.userId,
        type: 'abandoned_cart',
        language: await resolveUserLanguage(db, cart.data.userId),
        channels: ['push'],
      })
    }),
  )
})
