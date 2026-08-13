import { getFirestore } from 'firebase-admin/firestore'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { releaseReservationAndCancel } from './stockReservation.js'

const BATCH_SIZE = 50

/**
 * Cancels abandoned/expired `pending_payment` orders and releases their
 * stock reservation (design spec: "user abandons (scheduled function
 * releases reservations older than 15 minutes)"). Also the mechanism that
 * finishes off a `payment.failed` webhook's shortened grace period — see
 * razorpayWebhook.ts. Runs every 5 minutes, well inside the 15-minute
 * default window, so a reservation is never held meaningfully longer than
 * config/app.reservationExpiryMinutes promises.
 */
export const releaseExpiredReservations = onSchedule(
  { region: 'asia-south1', schedule: 'every 5 minutes' },
  async () => {
    const now = Date.now()
    const snapshot = await getFirestore()
      .collection('orders')
      .where('status', '==', 'pending_payment')
      .where('reservationExpiresAt', '<=', now)
      .limit(BATCH_SIZE)
      .get()

    await Promise.all(snapshot.docs.map((doc) => releaseReservationAndCancel(doc.id, 'reservation_expired')))
  },
)
