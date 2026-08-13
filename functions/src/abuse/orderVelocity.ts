import type { Firestore } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'

const VELOCITY_WINDOW_MS = 60 * 60_000
/** Below createOrder's own 20/hour hard rate limit — this is a softer, admin-visible signal for review, not a block, so a genuine bulk buyer (garage/fleet placing several separate orders in a session) is flagged for a human to glance at, not stopped. */
const VELOCITY_FLAG_THRESHOLD = 8

/**
 * Best-effort order-velocity abuse signal (Phase 23): counts this buyer's
 * orders in the trailing hour and, past the threshold, sets
 * `users/{buyerId}.orderVelocityFlag` for admin review — same
 * "auto-set flag, never auto-enforced" convention as returnAbuseFlag
 * (flagReturnAbuseBuyers.ts). Reuses the existing `buyerId ASC, createdAt
 * DESC` composite index on `orders` (createdAt == placedAt at order-creation
 * time) rather than requiring a new one. Called after an order is placed;
 * any failure here is logged and swallowed — a missed abuse flag is never
 * worth failing the buyer's actual order over.
 */
export async function checkOrderVelocity(db: Firestore, buyerId: string, now: number): Promise<void> {
  try {
    const windowStart = now - VELOCITY_WINDOW_MS
    const countSnapshot = await db
      .collection('orders')
      .where('buyerId', '==', buyerId)
      .where('createdAt', '>=', windowStart)
      .count()
      .get()

    if (countSnapshot.data().count >= VELOCITY_FLAG_THRESHOLD) {
      await db.collection('users').doc(buyerId).update({ orderVelocityFlag: true, updatedAt: now })
    }
  } catch (error) {
    logger.error('checkOrderVelocity failed', { buyerId, error: error instanceof Error ? error.message : String(error) })
  }
}
