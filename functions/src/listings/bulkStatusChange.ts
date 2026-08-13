import { type BulkStatusChangeResult, bulkStatusChangeRequestSchema, listingSchema } from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { requireSellerPermission } from '../seller/staffAuthz.js'

const BATCH_LIMIT = 400

/** manage_listings-gated bulk pause/activate/archive (requirement 4) — the same rule updateListingStatus.ts enforces (can't activate an out-of-stock listing) is enforced per-row here too, not just skipped for bulk convenience. */
export const bulkStatusChange = onCall(
  { enforceAppCheck: true, region: 'asia-south1' },
  async (request): Promise<BulkStatusChangeResult> => {
    const sellerId = requireSellerPermission(request, 'manage_listings')

    const parsed = bulkStatusChangeRequestSchema.safeParse(request.data)
    if (!parsed.success) throw new HttpsError('invalid-argument', parsed.error.issues[0]?.message ?? 'invalid_request')
    const { listingIds, status } = parsed.data

    const db = getFirestore()
    const refs = listingIds.map((id) => db.collection('listings').doc(id))
    const snapshots = await db.getAll(...refs)

    const updatedListingIds: string[] = []
    const failedListingIds: string[] = []
    const now = Date.now()

    const writes: FirebaseFirestore.DocumentReference[] = []
    for (const snapshot of snapshots) {
      const parsedListing = snapshot.exists ? listingSchema.safeParse({ id: snapshot.id, ...snapshot.data() }) : undefined
      if (!snapshot.exists || !parsedListing?.success || parsedListing.data.sellerId !== sellerId) {
        failedListingIds.push(snapshot.id)
        continue
      }
      if (status === 'active' && parsedListing.data.stockQty <= 0) {
        failedListingIds.push(snapshot.id)
        continue
      }
      writes.push(snapshot.ref)
    }

    for (let i = 0; i < writes.length; i += BATCH_LIMIT) {
      const chunk = writes.slice(i, i + BATCH_LIMIT)
      const batch = db.batch()
      for (const ref of chunk) {
        batch.update(ref, { status, pausedByHolidayMode: false, updatedAt: now })
      }
      await batch.commit()
      updatedListingIds.push(...chunk.map((ref) => ref.id))
    }

    return { updatedListingIds, failedListingIds }
  },
)
