import {
  listingSchema,
  rfqQuoteSchema,
  rfqSchema,
  sellerSchema,
  submitRfqQuoteRequestSchema,
  type SubmitRfqQuoteResult,
} from '@snapspare/shared'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { requireSellerId } from '../orders/authz.js'
import { queueNotification, type NotificationLanguage } from '../orders/notify.js'
import { enforceRateLimit } from '../util/rateLimit.js'
import { stripUndefined } from '../util/stripUndefined.js'

/**
 * Seller submits (or re-submits after withdrawing) a quote on an open/quoted
 * RFQ. `qtyOffered` doubles as the seller's counter-quantity — requirement 3
 * — a seller free to quote a different quantity than `rfq.qtyRequested`
 * ("I can do 80 at this price"). Rejects once the RFQ has passed its
 * response window (set by routing.ts at creation) or already has a pending
 * quote from this seller — the seller must withdrawRfqQuote first to
 * re-quote, keeping "one live quote per seller per rfq" simple to reason
 * about on the buyer's comparison view.
 */
export const submitRfqQuote = onCall({ enforceAppCheck: true, region: 'asia-south1' }, async (request): Promise<SubmitRfqQuoteResult> => {
  const sellerId = requireSellerId(request)

  const parsed = submitRfqQuoteRequestSchema.safeParse(request.data)
  if (!parsed.success) throw new HttpsError('invalid-argument', 'A valid quote is required')
  const input = parsed.data

  await enforceRateLimit(request, { name: 'submitRfqQuote', perUidLimit: 40, perIpLimit: 80, windowMinutes: 60 })

  const db = getFirestore()
  const rfqRef = db.collection('rfqs').doc(input.rfqId)
  const quoteRef = db.collection('rfqQuotes').doc()
  const now = Date.now()

  const quoteId = await db.runTransaction(async (tx) => {
    // ---- reads (all reads must precede all writes) ----
    const rfqSnapshot = await tx.get(rfqRef)
    const sellerSnapshot = await tx.get(db.collection('sellers').doc(sellerId))
    const existingQuoteSnapshot = await tx.get(
      db.collection('rfqQuotes').where('rfqId', '==', input.rfqId).where('sellerId', '==', sellerId).where('status', '==', 'pending').limit(1),
    )
    const listingSnapshot = input.listingId ? await tx.get(db.collection('listings').doc(input.listingId)) : undefined
    const buyerSnapshot = rfqSnapshot.exists ? await tx.get(db.collection('users').doc(rfqSnapshot.data()?.buyerId as string)) : undefined

    // ---- validate ----
    if (!rfqSnapshot.exists) throw new HttpsError('not-found', 'rfq_not_found')
    const rfq = rfqSchema.parse({ id: rfqSnapshot.id, ...rfqSnapshot.data() })
    if (!sellerSnapshot.exists) throw new HttpsError('failed-precondition', 'seller_unavailable')
    const seller = sellerSchema.parse({ id: sellerSnapshot.id, ...sellerSnapshot.data() })

    if (rfq.status !== 'open' && rfq.status !== 'quoted') {
      throw new HttpsError('failed-precondition', 'rfq_not_open')
    }
    if (rfq.responseDeadline !== undefined && now > rfq.responseDeadline) {
      throw new HttpsError('failed-precondition', 'response_window_closed')
    }
    if (!existingQuoteSnapshot.empty) {
      throw new HttpsError('failed-precondition', 'quote_already_pending')
    }
    if (!rfq.partId && (!input.hsnCode || !input.gstRatePercent)) {
      throw new HttpsError('invalid-argument', 'hsn_and_gst_required_for_free_text_rfq')
    }
    if (input.listingId) {
      if (!listingSnapshot?.exists) throw new HttpsError('not-found', 'listing_not_found')
      const listing = listingSchema.parse({ id: listingSnapshot.id, ...listingSnapshot.data() })
      if (listing.sellerId !== sellerId) throw new HttpsError('permission-denied', 'listing_not_owned')
    }

    const preferredLanguage = buyerSnapshot?.exists ? buyerSnapshot.data()?.preferredLanguage : undefined
    const buyerLanguage: NotificationLanguage = preferredLanguage === 'hi' ? 'hi' : 'en'

    // ---- writes ----
    const { id: _id, ...quoteDoc } = rfqQuoteSchema.parse({
      id: quoteRef.id,
      rfqId: input.rfqId,
      sellerId,
      buyerId: rfq.buyerId,
      sellerName: seller.businessName,
      sellerRatingAvg: seller.ratingAvg,
      sellerRatingCount: seller.ratingCount,
      unitPricePaise: input.unitPricePaise,
      qtyOffered: input.qtyOffered,
      moq: input.moq,
      leadTimeDays: input.leadTimeDays,
      notes: input.notes,
      listingId: input.listingId,
      hsnCode: input.hsnCode,
      gstRatePercent: input.gstRatePercent,
      status: 'pending',
      validUntil: input.validUntil,
      createdAt: now,
      updatedAt: now,
    })
    tx.set(quoteRef, stripUndefined(quoteDoc))

    tx.update(rfqRef, {
      status: rfq.status === 'open' ? 'quoted' : rfq.status,
      quoteCount: FieldValue.increment(1),
      updatedAt: now,
    })

    queueNotification(tx, db, {
      userId: rfq.buyerId,
      type: 'rfq_quote_received',
      language: buyerLanguage,
      rfqId: rfq.id,
    })

    return quoteRef.id
  })

  return { quoteId }
})
