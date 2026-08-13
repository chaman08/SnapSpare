import {
  catalogPartSchema,
  listingSchema,
  sellerSchema,
  type SubmitWarrantyClaimResult,
  submitWarrantyClaimRequestSchema,
  subOrderSchema,
  warrantyClaimSchema,
} from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { requireUid } from '../orders/authz.js'
import { queueNotificationDirect } from '../orders/notify.js'
import { resolveUserLanguage } from '../seller/notifyLanguage.js'
import { stripUndefined } from '../util/stripUndefined.js'

const AVG_DAYS_PER_MONTH_MS = 30 * 24 * 60 * 60_000

/**
 * Buyer-initiated warranty claim (design brief item 6) — separate from a
 * return: valid for `listing.warrantyMonths` after delivery (not the much
 * shorter return window), and never affects stock/subOrder status on its
 * own. Evidence images are required (same "unsubstantiated claim isn't
 * actionable" rule as requestReturn.ts's damage/defect reasons) and are
 * Storage paths uploaded client-side beforehand — see
 * getWarrantyClaimEvidenceUrls.ts for how they're read back.
 */
export const submitWarrantyClaim = onCall({ enforceAppCheck: true, region: 'asia-south1' }, async (request): Promise<SubmitWarrantyClaimResult> => {
  const buyerId = requireUid(request)

  const parsed = submitWarrantyClaimRequestSchema.safeParse(request.data)
  if (!parsed.success) throw new HttpsError('invalid-argument', 'A valid warranty claim is required')
  const input = parsed.data

  const db = getFirestore()
  const [subOrderSnapshot, listingSnapshot] = await Promise.all([
    db.collection('subOrders').doc(input.subOrderId).get(),
    db.collection('listings').doc(input.listingId).get(),
  ])
  if (!subOrderSnapshot.exists) throw new HttpsError('not-found', 'subOrder_not_found')
  const subOrder = subOrderSchema.parse({ id: subOrderSnapshot.id, ...subOrderSnapshot.data() })
  if (subOrder.buyerId !== buyerId) throw new HttpsError('permission-denied', 'not_your_order')
  if (subOrder.status !== 'delivered') throw new HttpsError('failed-precondition', 'not_delivered')

  const item = subOrder.items.find((line) => line.listingId === input.listingId)
  if (!item) throw new HttpsError('invalid-argument', 'item_not_in_suborder')

  const deliveredAt = subOrder.shipment?.deliveredAt
  if (deliveredAt === undefined) throw new HttpsError('failed-precondition', 'delivery_not_recorded')

  if (!listingSnapshot.exists) throw new HttpsError('failed-precondition', 'listing_not_found')
  const listing = listingSchema.parse({ id: listingSnapshot.id, ...listingSnapshot.data() })
  if (listing.warrantyMonths === undefined || listing.warrantyMonths <= 0) {
    throw new HttpsError('failed-precondition', 'no_warranty')
  }
  if (Date.now() > deliveredAt + listing.warrantyMonths * AVG_DAYS_PER_MONTH_MS) {
    throw new HttpsError('failed-precondition', 'warranty_expired')
  }

  const catalogPartSnapshot = await db.collection('catalogParts').doc(item.partId).get()
  const catalogPart = catalogPartSnapshot.exists
    ? catalogPartSchema.safeParse({ id: catalogPartSnapshot.id, ...catalogPartSnapshot.data() })
    : undefined

  const now = Date.now()
  const ref = db.collection('warrantyClaims').doc()
  const { id: _id, ...doc } = warrantyClaimSchema.parse({
    id: ref.id,
    orderId: subOrder.orderId,
    subOrderId: subOrder.id,
    listingId: input.listingId,
    partId: item.partId,
    partNumber: catalogPart?.success ? catalogPart.data.partNumber : item.sku,
    buyerId,
    sellerId: subOrder.sellerId,
    reason: input.reason,
    description: input.description,
    evidenceImages: input.evidenceImages,
    evidenceVideoPath: input.evidenceVideoPath,
    status: 'submitted',
    brandName: catalogPart?.success ? catalogPart.data.brand : undefined,
    claimedAt: now,
    createdAt: now,
    updatedAt: now,
  })
  await ref.set(stripUndefined(doc))

  const sellerSnapshot = await db.collection('sellers').doc(subOrder.sellerId).get()
  if (sellerSnapshot.exists) {
    const seller = sellerSchema.safeParse({ id: sellerSnapshot.id, ...sellerSnapshot.data() })
    if (seller.success) {
      await queueNotificationDirect(db, {
        userId: seller.data.ownerUserId,
        type: 'warranty_claim_submitted',
        language: await resolveUserLanguage(db, seller.data.ownerUserId),
        orderId: subOrder.orderId,
        subOrderId: subOrder.id,
        warrantyClaimId: ref.id,
        listingId: input.listingId,
        partId: item.partId,
      })
    }
  }

  return { claimId: ref.id }
})
