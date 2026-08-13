import { type AdjustStockResult, adjustStockRequestSchema, listingSchema } from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { requireSellerPermission } from '../seller/staffAuthz.js'
import { stripUndefined } from '../util/stripUndefined.js'

/**
 * manage_listings-gated manual stock adjustment (restock/adjustment/
 * correction — never 'sale'/'return', which are only ever posted by the
 * order-lifecycle paths, see stockOps.ts/checkout). Reads the listing
 * inside its own transaction, so unlike the retrofitted order-lifecycle
 * ledger entries, this one always knows `balanceAfter`.
 * `onListingStockAutoStatus.ts` reacts to the resulting `stockQty` write on
 * its own (active⇄out_of_stock) — not duplicated here.
 */
export const adjustStock = onCall({ enforceAppCheck: true, region: 'asia-south1' }, async (request): Promise<AdjustStockResult> => {
  const sellerId = requireSellerPermission(request, 'manage_listings')

  const parsed = adjustStockRequestSchema.safeParse(request.data)
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', parsed.error.issues[0]?.message ?? 'invalid_request')
  }
  const { listingId, deltaQty, reason, note } = parsed.data

  const db = getFirestore()

  const balanceAfter = await db.runTransaction(async (tx) => {
    const ref = db.collection('listings').doc(listingId)
    const snapshot = await tx.get(ref)
    if (!snapshot.exists) throw new HttpsError('not-found', 'listing_not_found')
    const listing = listingSchema.parse({ id: snapshot.id, ...snapshot.data() })
    if (listing.sellerId !== sellerId) throw new HttpsError('permission-denied', 'not_your_listing')

    const nextQty = listing.stockQty + deltaQty
    if (nextQty < 0) throw new HttpsError('failed-precondition', 'insufficient_stock')

    const now = Date.now()
    tx.update(ref, { stockQty: nextQty, updatedAt: now })
    tx.set(
      db.collection('stockLedger').doc(),
      stripUndefined({
        listingId,
        sellerId,
        deltaQty,
        reason,
        actorId: request.auth?.uid,
        note,
        balanceAfter: nextQty,
        createdAt: now,
      }),
    )

    return nextQty
  })

  return { balanceAfter }
})
