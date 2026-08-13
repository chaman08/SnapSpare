import type { GetListingAnomalyReportResult, OutOfStockRow, PriceAnomalyRow } from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { isAdminRequest } from '../orders/authz.js'

const ABOVE_MRP_RATIO = 1.1
const BELOW_MRP_RATIO = 0.5

/**
 * Listings module (design brief item 5): price-anomaly + out-of-stock
 * reports. "Far above/below market" is approximated against each listing's
 * own `mrpPaise` (>10% above or <50% of it) rather than a cross-seller
 * market-price index, which nothing in this codebase computes yet — see
 * priceAnomalyRowSchema's header comment. Scans up to 2000 active listings;
 * fine for an on-demand admin report, not meant for a much larger catalogue
 * without a precomputed index.
 */
export const getListingAnomalyReport = onCall(
  { enforceAppCheck: true, region: 'asia-south1', timeoutSeconds: 120 },
  async (request): Promise<GetListingAnomalyReportResult> => {
    if (!request.auth || !isAdminRequest(request)) throw new HttpsError('permission-denied', 'admin_only')

    const db = getFirestore()
    const [activeSnapshot, outOfStockSnapshot] = await Promise.all([
      db.collection('listings').where('status', '==', 'active').limit(2000).get(),
      db.collection('listings').where('status', '==', 'out_of_stock').limit(200).get(),
    ])

    const priceAnomalies: PriceAnomalyRow[] = []
    for (const doc of activeSnapshot.docs) {
      const data = doc.data()
      const mrpPaise = data.mrpPaise as number | undefined
      const tiers = data.pricing?.tiers as { unitPricePaise: number }[] | undefined
      const lowestTierUnitPricePaise = tiers && tiers.length > 0 ? tiers[0]!.unitPricePaise : undefined
      if (!mrpPaise || mrpPaise <= 0 || lowestTierUnitPricePaise === undefined) continue

      const ratio = lowestTierUnitPricePaise / mrpPaise
      if (ratio > ABOVE_MRP_RATIO) {
        priceAnomalies.push({
          listingId: doc.id,
          sellerId: data.sellerId as string,
          title: data.title as string,
          mrpPaise,
          lowestTierUnitPricePaise,
          ratioToMrp: ratio,
          direction: 'above',
        })
      } else if (ratio < BELOW_MRP_RATIO) {
        priceAnomalies.push({
          listingId: doc.id,
          sellerId: data.sellerId as string,
          title: data.title as string,
          mrpPaise,
          lowestTierUnitPricePaise,
          ratioToMrp: ratio,
          direction: 'below',
        })
      }
    }

    const outOfStock: OutOfStockRow[] = outOfStockSnapshot.docs.map((doc) => ({
      listingId: doc.id,
      sellerId: doc.data().sellerId as string,
      title: doc.data().title as string,
      updatedAt: doc.data().updatedAt as number,
    }))

    priceAnomalies.sort((a, b) => Math.abs(b.ratioToMrp - 1) - Math.abs(a.ratioToMrp - 1))

    return { priceAnomalies, outOfStock }
  },
)
