import { type CreateRfqResult, createRfqRequestSchema, rfqSchema, userSchema } from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { matchSellersForRfq } from './routing.js'
import { enforceRateLimit } from '../util/rateLimit.js'
import { stripUndefined } from '../util/stripUndefined.js'

/**
 * Buyer-facing RFQ creation, replacing the old direct client-side `addDoc`
 * (apps/web previously wrote to `rfqs` straight from
 * features/search/api/createRfq.ts — see firestore.rules, now
 * Cloud-Function-only). Validates the request, writes the rfq doc, then
 * synchronously runs seller matching/notification/response-window setup
 * (requirement 2) so the buyer's response includes how many sellers were
 * notified.
 */
export const createRfq = onCall({ enforceAppCheck: true, region: 'asia-south1' }, async (request): Promise<CreateRfqResult> => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required')
  const buyerId = request.auth.uid

  const parsed = createRfqRequestSchema.safeParse(request.data)
  if (!parsed.success) throw new HttpsError('invalid-argument', 'A valid RFQ request is required')
  const input = parsed.data

  await enforceRateLimit(request, { name: 'createRfq', perUidLimit: 20, perIpLimit: 40, windowMinutes: 60 })

  const db = getFirestore()
  const buyerSnapshot = await db.collection('users').doc(buyerId).get()
  if (!buyerSnapshot.exists) throw new HttpsError('failed-precondition', 'buyer_profile_missing')
  const buyer = userSchema.parse({ id: buyerSnapshot.id, ...buyerSnapshot.data() })

  const now = Date.now()
  const rfqRef = db.collection('rfqs').doc()
  const { id: _id, ...rfqDoc } = rfqSchema.parse({
    id: rfqRef.id,
    buyerId,
    buyerType: buyer.buyerType ?? 'retail',
    partId: input.partId,
    freeTextDescription: input.freeTextDescription,
    categorySlug: input.categorySlug,
    qtyRequested: input.qtyRequested,
    targetPricePaise: input.targetPricePaise,
    vehicleVariantId: input.vehicleVariantId,
    deliveryPincode: input.deliveryPincode,
    requiredByDate: input.requiredByDate,
    notes: input.notes,
    status: 'open',
    attachments: input.attachments,
    routedSellerIds: [],
    quoteCount: 0,
    createdAt: now,
    updatedAt: now,
  })
  await rfqRef.set(stripUndefined(rfqDoc))

  const routing = await matchSellersForRfq(db, rfqRef.id, {
    partId: input.partId,
    categorySlug: input.categorySlug,
    deliveryPincode: input.deliveryPincode,
  })

  return { rfqId: rfqRef.id, routedSellerCount: routing.routedSellerIds.length }
})
