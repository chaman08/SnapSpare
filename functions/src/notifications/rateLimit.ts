import type { NotificationChannel } from '@snapspare/shared'
import type { Firestore } from 'firebase-admin/firestore'

const IST_OFFSET_MS = 5.5 * 60 * 60_000
const DAY_MS = 24 * 60 * 60_000

/** Daily send caps per channel — marketing sends only (transactional always sends, per the hard rule in preferences.ts). Deliberately conservative to keep the product from reading as spam. */
const DAILY_CAPS: Record<NotificationChannel, number> = {
  push: 20,
  whatsapp: 10,
  sms: 5,
  email: 10,
}

function istDateKey(nowMs: number): string {
  const istMs = nowMs + IST_OFFSET_MS
  return new Date(istMs - (istMs % DAY_MS)).toISOString().slice(0, 10)
}

/**
 * Transactionally checks and increments today's (IST) per-user/per-channel
 * marketing send counter. Returns false (and does not increment) once the
 * channel's daily cap is hit — the caller should record that channel as
 * `skipped` with reason `rate_limited` rather than attempting a send.
 */
export async function checkAndIncrementRateLimit(
  db: Firestore,
  userId: string,
  channel: NotificationChannel,
): Promise<boolean> {
  const date = istDateKey(Date.now())
  const counterRef = db.collection('notificationRateCounters').doc(`${userId}_${channel}_${date}`)
  const cap = DAILY_CAPS[channel]

  return db.runTransaction(async (tx) => {
    const snapshot = await tx.get(counterRef)
    const count = snapshot.exists ? ((snapshot.data()?.count as number | undefined) ?? 0) : 0
    if (count >= cap) return false

    if (snapshot.exists) {
      tx.update(counterRef, { count: count + 1 })
    } else {
      tx.set(counterRef, { userId, channel, date, count: 1 })
    }
    return true
  })
}
