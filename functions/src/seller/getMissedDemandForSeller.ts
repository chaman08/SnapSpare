import { type GetMissedDemandForSellerResult, sellerSchema } from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { onCall } from 'firebase-functions/v2/https'
import { requireSellerId } from '../orders/authz.js'

const LOOKBACK_MS = 30 * 24 * 60 * 60_000
const CHUNK_SIZE = 30 // Firestore 'in' query limit
const MAX_MISSES_SCANNED = 1000
const MAX_ITEMS_RETURNED = 20

/**
 * Requirement 6's "missed demand" panel — `searchMisses` has no `sellerId`
 * field and stays admin-read-only in firestore.rules (see its header
 * comment), so this callable is the only way a seller sees what buyers
 * searched for and didn't find, scoped server-side to their own
 * `categorySlugs` rather than widening that collection's read rule.
 * Read-only and low-sensitivity (aggregated query text only, no buyer PII
 * beyond what's already in the query string), so any seller staff member
 * can call it — no specific permission required, unlike the write-side
 * bulk/listing callables.
 */
export const getMissedDemandForSeller = onCall(
  { enforceAppCheck: true, region: 'asia-south1' },
  async (request): Promise<GetMissedDemandForSellerResult> => {
    const sellerId = requireSellerId(request)

    const db = getFirestore()
    const sellerSnapshot = await db.collection('sellers').doc(sellerId).get()
    if (!sellerSnapshot.exists) return { items: [] }
    const seller = sellerSchema.parse({ id: sellerSnapshot.id, ...sellerSnapshot.data() })
    if (seller.categorySlugs.length === 0) return { items: [] }

    const since = Date.now() - LOOKBACK_MS
    const byNormalizedQuery = new Map<string, { sampleQuery: string; count: number; categorySlug?: string }>()

    for (let i = 0; i < seller.categorySlugs.length; i += CHUNK_SIZE) {
      const chunk = seller.categorySlugs.slice(i, i + CHUNK_SIZE)
      const snapshot = await db
        .collection('searchMisses')
        .where('categorySlug', 'in', chunk)
        .where('createdAt', '>=', since)
        .limit(MAX_MISSES_SCANNED)
        .get()

      for (const doc of snapshot.docs) {
        const data = doc.data()
        const normalizedQuery = typeof data.normalizedQuery === 'string' ? data.normalizedQuery : undefined
        if (!normalizedQuery) continue
        const existing = byNormalizedQuery.get(normalizedQuery)
        if (existing) {
          existing.count += 1
        } else {
          byNormalizedQuery.set(normalizedQuery, {
            sampleQuery: typeof data.query === 'string' ? data.query : normalizedQuery,
            count: 1,
            categorySlug: typeof data.categorySlug === 'string' ? data.categorySlug : undefined,
          })
        }
      }
    }

    const items = Array.from(byNormalizedQuery.entries())
      .map(([normalizedQuery, v]) => ({ normalizedQuery, ...v }))
      .sort((a, b) => b.count - a.count)
      .slice(0, MAX_ITEMS_RETURNED)

    return { items }
  },
)
