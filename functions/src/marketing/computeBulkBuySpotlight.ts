import { getFirestore } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import { onSchedule } from 'firebase-functions/v2/scheduler'

const MAX_SPOTLIGHT_LISTINGS = 12

interface RankedListing {
  listingId: string
  discountPercent: number
}

/**
 * Growth module (Phase 20 design brief item 1) — ranks every active listing
 * by its deepest quantity-slab discount (base-tier unit price vs. the
 * cheapest, deepest-bulk tier price) so the homepage's "bulk-buy spotlight"
 * rail always surfaces genuinely the biggest slab savings on the platform,
 * not an admin's manual pick. Writes one small computed doc so the client
 * never has to scan the full `listings` collection to build this rail.
 */
export const computeBulkBuySpotlight = onSchedule(
  { region: 'asia-south1', schedule: 'every day 02:30', timeZone: 'Etc/UTC' },
  async () => {
    const db = getFirestore()
    const snapshot = await db.collection('listings').where('status', '==', 'active').get()

    const ranked: RankedListing[] = []
    for (const doc of snapshot.docs) {
      const tiers = doc.data().pricing?.tiers as { unitPricePaise?: number }[] | undefined
      if (!tiers || tiers.length < 2) continue

      const firstPrice = tiers[0]?.unitPricePaise
      const lastPrice = tiers[tiers.length - 1]?.unitPricePaise
      if (!firstPrice || lastPrice === undefined || firstPrice <= 0) continue

      const discountPercent = Math.round(((firstPrice - lastPrice) / firstPrice) * 100)
      if (discountPercent > 0) ranked.push({ listingId: doc.id, discountPercent })
    }

    ranked.sort((a, b) => b.discountPercent - a.discountPercent)
    const listingIds = ranked.slice(0, MAX_SPOTLIGHT_LISTINGS).map((entry) => entry.listingId)

    await db.collection('homepageComputed').doc('bulkBuySpotlight').set({ listingIds, computedAt: Date.now() })

    logger.info('computeBulkBuySpotlight completed', { candidates: snapshot.size, selected: listingIds.length })
  },
)
