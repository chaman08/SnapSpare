import {
  adminSetListingStatusRequestSchema,
  type AdminSetListingStatusResult,
  listingSchema,
} from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { isAdminRequest } from '../orders/authz.js'
import { writeAuditLog } from '../util/auditLog.js'

/** Listings module (design brief item 5): admin block (`rejected`, reason required) / unblock (`active`) — distinct from the seller-facing updateListingStatus.ts, which never allows `rejected` as a target. */
export const adminSetListingStatus = onCall(
  { enforceAppCheck: true, region: 'asia-south1' },
  async (request): Promise<AdminSetListingStatusResult> => {
    if (!request.auth || !isAdminRequest(request)) throw new HttpsError('permission-denied', 'admin_only')

    const parsed = adminSetListingStatusRequestSchema.safeParse(request.data)
    if (!parsed.success) throw new HttpsError('invalid-argument', 'Invalid request')
    const input = parsed.data

    if (input.status === 'rejected' && !input.reason) {
      throw new HttpsError('invalid-argument', 'reason_required_to_block')
    }

    const db = getFirestore()
    const ref = db.collection('listings').doc(input.id)
    const snapshot = await ref.get()
    if (!snapshot.exists) throw new HttpsError('not-found', 'listing_not_found')
    const listing = listingSchema.parse({ id: snapshot.id, ...snapshot.data() })

    const now = Date.now()
    await ref.update({ status: input.status, updatedAt: now })

    await writeAuditLog({
      request,
      action: input.status === 'rejected' ? 'listing.block' : 'listing.unblock',
      targetType: 'listings',
      targetId: listing.id,
      before: { status: listing.status },
      after: { status: input.status },
      note: input.reason,
    })

    return { status: input.status }
  },
)
