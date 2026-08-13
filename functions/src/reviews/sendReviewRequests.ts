import { listingSchema, reviewEligibilitySchema } from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { queueNotificationDirect } from '../orders/notify.js'
import { resolveUserLanguage } from '../seller/notifyLanguage.js'

const DAY_MS = 24 * 60 * 60_000
const REVIEW_REQUEST_LEAD_DAYS = 3

/**
 * Daily sweep, design brief item 1: "requested by a scheduled function 3
 * days after delivery via WhatsApp with a deep link." Fires once per
 * eligible purchase (`reminderSentAt` gates the repeat, same idiom as
 * creditDueReminders.ts's beforeReminderSentAt) for every still-eligible
 * reviewEligibility doc old enough to have crossed the 3-day mark.
 */
export const sendReviewRequests = onSchedule({ region: 'asia-south1', schedule: 'every 24 hours' }, async () => {
  const db = getFirestore()
  const now = Date.now()

  const snapshot = await db
    .collection('reviewEligibility')
    .where('eligible', '==', true)
    .where('reminderSentAt', '==', null)
    .where('createdAt', '<=', now - REVIEW_REQUEST_LEAD_DAYS * DAY_MS)
    .limit(200)
    .get()

  await Promise.all(
    snapshot.docs.map(async (doc) => {
      const parsed = reviewEligibilitySchema.safeParse({ id: doc.id, ...doc.data() })
      if (!parsed.success) return
      const eligibility = parsed.data

      const listingSnapshot = await db.collection('listings').doc(eligibility.listingId).get()
      const listingParsed = listingSnapshot.exists
        ? listingSchema.safeParse({ id: listingSnapshot.id, ...listingSnapshot.data() })
        : undefined
      const label = eligibility.vehicleFitted?.label ?? (listingParsed?.success ? listingParsed.data.title : undefined)

      await doc.ref.update({ reminderSentAt: now })
      await queueNotificationDirect(db, {
        userId: eligibility.buyerId,
        type: 'review_request',
        language: await resolveUserLanguage(db, eligibility.buyerId),
        listingId: eligibility.listingId,
        partId: eligibility.partId,
        channels: ['whatsapp', 'push'],
        copyInput: { label },
        data: { label: label ?? '' },
      })
    }),
  )
})
