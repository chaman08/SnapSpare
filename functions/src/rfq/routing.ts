import {
  catalogPartSchema,
  type IndianStateCode,
  isValidStateCode,
  pincodeMasterSchema,
  resolveShippingZone,
  sellerSchema,
} from '@snapspare/shared'
import type { Firestore } from 'firebase-admin/firestore'
import { queueNotificationDirect } from '../orders/notify.js'
import { resolveUserLanguage } from '../seller/notifyLanguage.js'

const MAX_ROUTED_SELLERS = 10
const RESPONSE_WINDOW_MS = 48 * 60 * 60 * 1000
const CANDIDATE_QUERY_LIMIT = 50

export interface RoutingResult {
  routedSellerIds: string[]
  responseDeadline: number
}

interface RfqForRouting {
  partId?: string
  categorySlug?: string
  deliveryPincode: string
}

async function resolveCategorySlug(db: Firestore, rfq: RfqForRouting): Promise<string | undefined> {
  if (!rfq.partId) return rfq.categorySlug
  const snapshot = await db.collection('catalogParts').doc(rfq.partId).get()
  if (!snapshot.exists) return rfq.categorySlug
  const parsed = catalogPartSchema.safeParse({ id: snapshot.id, ...snapshot.data() })
  return parsed.success ? parsed.data.categorySlug : rfq.categorySlug
}

/**
 * Requirement 2: matches the rfq to sellers by category + serviceability,
 * notifies the top N, and enforces a response window. Invoked synchronously
 * from createRfq.ts (not a separate Firestore trigger) so the buyer gets an
 * immediate "N sellers notified" result.
 *
 * Brand matching is not implemented — `Seller` has no brand field in the
 * schema today, only `categorySlugs`. Serviceability is state-level (the
 * seller's GSTIN state vs. the delivery pincode's state), matching
 * checkServiceability.ts's existing fidelity, not a live courier check. When
 * the buyer's state can't be resolved (unknown pincode), the serviceability
 * filter is skipped rather than routing to nobody — category match alone is
 * still useful signal.
 *
 * Best-effort: a failure while matching/notifying never throws back up to
 * the caller — the RFQ itself has already been created and is the far more
 * important artifact. `responseDeadline` is always set, even on failure, so
 * expireRfqs.ts still has something to close the RFQ against eventually.
 */
export async function matchSellersForRfq(db: Firestore, rfqId: string, rfq: RfqForRouting): Promise<RoutingResult> {
  const now = Date.now()
  const responseDeadline = now + RESPONSE_WINDOW_MS
  const rfqRef = db.collection('rfqs').doc(rfqId)

  try {
    const categorySlug = await resolveCategorySlug(db, rfq)
    if (!categorySlug) {
      await rfqRef.update({ responseDeadline, updatedAt: now })
      return { routedSellerIds: [], responseDeadline }
    }

    const [candidatesSnapshot, pincodeSnapshot] = await Promise.all([
      db
        .collection('sellers')
        .where('status', '==', 'active')
        .where('categorySlugs', 'array-contains', categorySlug)
        .limit(CANDIDATE_QUERY_LIMIT)
        .get(),
      db.collection('pincodes').doc(rfq.deliveryPincode).get(),
    ])

    let buyerStateCode: IndianStateCode | undefined
    if (pincodeSnapshot.exists) {
      const parsedPincode = pincodeMasterSchema.safeParse({ id: pincodeSnapshot.id, ...pincodeSnapshot.data() })
      if (parsedPincode.success && isValidStateCode(parsedPincode.data.stateCode)) {
        buyerStateCode = parsedPincode.data.stateCode
      }
    }

    const ranked = candidatesSnapshot.docs
      .map((doc) => sellerSchema.safeParse({ id: doc.id, ...doc.data() }))
      .filter((parsed) => parsed.success)
      .map((parsed) => parsed.data)
      .filter((seller) => {
        if (!buyerStateCode) return true
        const sellerStateCode = seller.gstin.slice(0, 2)
        return isValidStateCode(sellerStateCode) && Boolean(resolveShippingZone(sellerStateCode, buyerStateCode))
      })
      .sort((a, b) => b.ratingAvg - a.ratingAvg || b.ratingCount - a.ratingCount)
      .slice(0, MAX_ROUTED_SELLERS)

    const routedSellerIds = ranked.map((seller) => seller.id)

    await rfqRef.update({ routedSellerIds, responseDeadline, updatedAt: now })

    await Promise.all(
      ranked.map(async (seller) => {
        const language = await resolveUserLanguage(db, seller.ownerUserId)
        await queueNotificationDirect(db, {
          userId: seller.ownerUserId,
          type: 'rfq_new_match',
          language,
          rfqId,
        })
      }),
    )

    return { routedSellerIds, responseDeadline }
  } catch (error) {
    console.error('matchSellersForRfq failed', { rfqId, error })
    await rfqRef.update({ responseDeadline, updatedAt: now }).catch(() => undefined)
    return { routedSellerIds: [], responseDeadline }
  }
}
