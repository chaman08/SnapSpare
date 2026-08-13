import {
  type UpdateListingStatusResult,
  listingSchema,
  updateListingStatusRequestSchema,
} from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { requireSellerPermission } from '../seller/staffAuthz.js'

/**
 * manage_listings-gated status-only transition (draft/active/paused/archived
 * — never `out_of_stock`, which only `onListingStockAutoStatus.ts` sets, or
 * `rejected`, which is admin-only). Deliberately doesn't re-validate the
 * whole listing shape like `persistListing.ts` does — it's a state-machine
 * flip, not a content edit — but does block reactivating a listing that's
 * actually out of stock, so a seller can't fight the auto-pause invariant by
 * hand.
 */
export const updateListingStatus = onCall(
  { enforceAppCheck: true, region: 'asia-south1' },
  async (request): Promise<UpdateListingStatusResult> => {
    const sellerId = requireSellerPermission(request, 'manage_listings')

    const parsed = updateListingStatusRequestSchema.safeParse(request.data)
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', parsed.error.issues[0]?.message ?? 'invalid_request')
    }
    const { id, status } = parsed.data

    const db = getFirestore()
    const ref = db.collection('listings').doc(id)
    const snapshot = await ref.get()
    if (!snapshot.exists) throw new HttpsError('not-found', 'listing_not_found')

    const listing = listingSchema.parse({ id: snapshot.id, ...snapshot.data() })
    if (listing.sellerId !== sellerId) throw new HttpsError('permission-denied', 'not_your_listing')

    if (status === 'active' && listing.stockQty <= 0) {
      throw new HttpsError('failed-precondition', 'cannot_activate_out_of_stock')
    }

    const now = Date.now()
    await ref.update({
      status,
      // Reactivating manually always clears the holiday-mode marker — this
      // is now an explicit seller action, so setHolidayMode's "only resume
      // what I paused" bookkeeping no longer applies to this listing.
      pausedByHolidayMode: false,
      updatedAt: now,
    })

    return { status }
  },
)
