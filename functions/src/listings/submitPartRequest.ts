import { type SubmitPartRequestResult, sellerSchema, submitPartRequestRequestSchema } from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { queueNotificationDirect } from '../orders/notify.js'
import { resolveUserLanguage } from '../seller/notifyLanguage.js'
import { requireSellerPermission } from '../seller/staffAuthz.js'
import { stripUndefined } from '../util/stripUndefined.js'

/**
 * manage_listings-gated. Writes `partRequests/{id}` (Admin SDK — kept
 * callable rather than a direct rules-guarded create for uniformity with
 * every other listing-adjacent write in this phase, see persistListing.ts's
 * posture) and queues a submission notification to the seller's owner.
 */
export const submitPartRequest = onCall(
  { enforceAppCheck: true, region: 'asia-south1' },
  async (request): Promise<SubmitPartRequestResult> => {
    const sellerId = requireSellerPermission(request, 'manage_listings')

    const parsed = submitPartRequestRequestSchema.safeParse(request.data)
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', parsed.error.issues[0]?.message ?? 'invalid_request', {
        issues: parsed.error.issues,
      })
    }

    const db = getFirestore()
    const sellerSnapshot = await db.collection('sellers').doc(sellerId).get()
    if (!sellerSnapshot.exists) throw new HttpsError('not-found', 'seller_not_found')
    const seller = sellerSchema.parse({ id: sellerSnapshot.id, ...sellerSnapshot.data() })

    const now = Date.now()
    const ref = db.collection('partRequests').doc()
    await ref.set(
      stripUndefined({
        ...parsed.data,
        sellerId,
        status: 'pending',
        reviewNotes: [],
        createdAt: now,
        updatedAt: now,
      }),
    )

    const language = await resolveUserLanguage(db, seller.ownerUserId)
    await queueNotificationDirect(db, {
      userId: seller.ownerUserId,
      type: 'part_request_submitted',
      language,
    })

    return { id: ref.id }
  },
)
