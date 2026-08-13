import { type BulkStockUpdateResult, bulkStockUpdateRequestSchema, listingSchema } from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { requireSellerPermission } from '../seller/staffAuthz.js'
import { stripUndefined } from '../util/stripUndefined.js'

const BATCH_LIMIT = 400

/**
 * manage_listings-gated. Bulk stock update (requirement 4) — 'set' pins
 * every listing to the same absolute quantity, 'delta' applies the same
 * +/- change to each. Reads all target listings first (ownership + current
 * stockQty), then writes in batches, appending a stockLedger entry per
 * listing exactly like adjustStock.ts's manual single-listing path — this
 * is just that same operation fanned out.
 * onListingStockAutoStatus.ts reacts to each resulting write on its own.
 */
export const bulkStockUpdate = onCall(
  { enforceAppCheck: true, region: 'asia-south1' },
  async (request): Promise<BulkStockUpdateResult> => {
    const sellerId = requireSellerPermission(request, 'manage_listings')

    const parsed = bulkStockUpdateRequestSchema.safeParse(request.data)
    if (!parsed.success) throw new HttpsError('invalid-argument', parsed.error.issues[0]?.message ?? 'invalid_request')
    const { listingIds, mode, value } = parsed.data

    const db = getFirestore()
    const refs = listingIds.map((id) => db.collection('listings').doc(id))
    const snapshots = await db.getAll(...refs)

    const updatedListingIds: string[] = []
    const failedListingIds: string[] = []
    const now = Date.now()

    const writes: { ref: FirebaseFirestore.DocumentReference; nextQty: number; deltaQty: number; listingId: string }[] = []
    for (const snapshot of snapshots) {
      const parsedListing = snapshot.exists ? listingSchema.safeParse({ id: snapshot.id, ...snapshot.data() }) : undefined
      if (!snapshot.exists || !parsedListing?.success || parsedListing.data.sellerId !== sellerId) {
        failedListingIds.push(snapshot.id)
        continue
      }
      const listing = parsedListing.data
      const nextQty = mode === 'set' ? value : listing.stockQty + value
      if (nextQty < 0) {
        failedListingIds.push(snapshot.id)
        continue
      }
      writes.push({ ref: snapshot.ref, nextQty, deltaQty: nextQty - listing.stockQty, listingId: snapshot.id })
    }

    for (let i = 0; i < writes.length; i += BATCH_LIMIT) {
      const chunk = writes.slice(i, i + BATCH_LIMIT)
      const batch = db.batch()
      for (const w of chunk) {
        batch.update(w.ref, { stockQty: w.nextQty, updatedAt: now })
        batch.set(
          db.collection('stockLedger').doc(),
          stripUndefined({
            listingId: w.listingId,
            sellerId,
            deltaQty: w.deltaQty,
            reason: 'adjustment',
            actorId: request.auth?.uid,
            balanceAfter: w.nextQty,
            createdAt: now,
          }),
        )
      }
      await batch.commit()
      updatedListingIds.push(...chunk.map((w) => w.listingId))
    }

    return { updatedListingIds, failedListingIds }
  },
)
