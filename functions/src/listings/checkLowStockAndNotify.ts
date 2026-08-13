import { listingSchema, sellerSchema } from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { queueNotificationDirect } from '../orders/notify.js'
import { resolveUserLanguage } from '../seller/notifyLanguage.js'

/** Used when a listing has no `lowStockThresholdQty` of its own. */
const DEFAULT_LOW_STOCK_THRESHOLD = 5

/**
 * Daily sweep flagging low-stock listings to their seller (requirement 5) —
 * one notification per seller (not per listing) so a seller with several
 * low-stock items gets a single summary, not a flood. In-app badges
 * (LowStockBadge.tsx, on already-fetched My Listings data) cover the
 * moment-to-moment view; this is only the proactive push/WhatsApp nudge.
 * Firestore can't query "stockQty <= <another field on the same doc>"
 * directly, so this scans every active listing and filters in memory —
 * fine at this phase's scale, revisit if the active-listing count grows
 * large enough to matter.
 */
export const checkLowStockAndNotify = onSchedule({ schedule: 'every 24 hours', region: 'asia-south1' }, async () => {
  const db = getFirestore()

  const snapshot = await db.collection('listings').where('status', '==', 'active').get()
  const lowStockCountBySeller = new Map<string, number>()

  for (const doc of snapshot.docs) {
    const parsed = listingSchema.safeParse({ id: doc.id, ...doc.data() })
    if (!parsed.success) continue
    const listing = parsed.data
    const threshold = listing.lowStockThresholdQty ?? DEFAULT_LOW_STOCK_THRESHOLD
    const available = listing.stockQty - listing.reservedStock
    if (available <= threshold) {
      lowStockCountBySeller.set(listing.sellerId, (lowStockCountBySeller.get(listing.sellerId) ?? 0) + 1)
    }
  }

  for (const [sellerId, count] of lowStockCountBySeller) {
    try {
      const sellerSnapshot = await db.collection('sellers').doc(sellerId).get()
      if (!sellerSnapshot.exists) continue
      const seller = sellerSchema.parse({ id: sellerSnapshot.id, ...sellerSnapshot.data() })
      const language = await resolveUserLanguage(db, seller.ownerUserId)
      await queueNotificationDirect(db, {
        userId: seller.ownerUserId,
        type: 'listing_low_stock',
        language,
        copyInput: { count },
      })
    } catch (error) {
      logger.error('checkLowStockAndNotify: failed to notify seller', {
        sellerId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  logger.info('checkLowStockAndNotify: sweep complete', { sellersNotified: lowStockCountBySeller.size })
})
