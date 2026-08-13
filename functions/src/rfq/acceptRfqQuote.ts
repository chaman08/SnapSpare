import type { AcceptRfqQuoteRequest, AcceptRfqQuoteResult, Listing, Seller, SubOrderItem } from '@snapspare/shared'
import {
  acceptRfqQuoteRequestSchema,
  addressSnapshotSchema,
  applyPercent,
  catalogPartSchema,
  computeChargeableWeightGrams,
  creditAccountSchema,
  DEFAULT_LISTING_WEIGHT_GRAMS,
  estimateSellerShipping,
  isInterState,
  isValidStateCode,
  listingSchema,
  orderSchema,
  resolveShippingZone,
  rfqQuoteSchema,
  rfqSchema,
  sellerSchema,
  splitProportionally,
  subOrderSchema,
  userSchema,
} from '@snapspare/shared'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { getAppConfig } from '../checkout/appConfig.js'
import { withIdempotency } from '../checkout/idempotency.js'
import { createRazorpayOrder } from '../checkout/razorpayClient.js'
import { RAZORPAY_KEY_SECRET } from '../checkout/secrets.js'
import { queueNotification, type NotificationLanguage } from '../orders/notify.js'
import { getShippingConfig } from '../shipping/shippingConfig.js'
import { stripUndefined } from '../util/stripUndefined.js'

interface TaxableAnchor {
  listing?: Listing
  sku: string
  title: string
  partId: string
  listingIdForItem: string
  hsnCode: string
  gstRatePercent: 0 | 5 | 12 | 18 | 28
  weightGrams: number
  dimensionsCm: Listing['dimensionsCm']
  isOversized: boolean
}

/**
 * Resolves what a converted order line is taxed/described as — requirement
 * 4's "locked one-off tier on the order line, never by mutating the public
 * listing". Three sources, in priority order: the quote's own `listingId`
 * (read for reference only — sku/title/hsn/gst/weight come from it, its
 * pricing tiers never do), the rfq's `catalogPart` if it has one, or the
 * quote's own `hsnCode`/`gstRatePercent` (required by submitRfqQuote.ts
 * whenever neither of the other two is available). When none resolve, the
 * RFQ simply can't be converted yet.
 */
async function resolveTaxableAnchor(
  db: FirebaseFirestore.Firestore,
  sellerId: string,
  rfq: { partId?: string; freeTextDescription?: string },
  quote: { id: string; listingId?: string; hsnCode?: string; gstRatePercent?: 0 | 5 | 12 | 18 | 28 },
): Promise<TaxableAnchor> {
  if (quote.listingId) {
    const snapshot = await db.collection('listings').doc(quote.listingId).get()
    if (!snapshot.exists) throw new HttpsError('not-found', 'listing_not_found')
    const listing = listingSchema.parse({ id: snapshot.id, ...snapshot.data() })
    if (listing.sellerId !== sellerId) throw new HttpsError('permission-denied', 'listing_not_owned')
    return {
      listing,
      sku: listing.sku,
      title: listing.title,
      partId: listing.partId,
      listingIdForItem: listing.id,
      hsnCode: listing.hsnCode,
      gstRatePercent: listing.gstRatePercent,
      weightGrams: listing.weightGrams ?? DEFAULT_LISTING_WEIGHT_GRAMS,
      dimensionsCm: listing.dimensionsCm,
      isOversized: listing.isOversized,
    }
  }

  if (rfq.partId) {
    const snapshot = await db.collection('catalogParts').doc(rfq.partId).get()
    if (!snapshot.exists) throw new HttpsError('failed-precondition', 'listing_or_part_required')
    const catalogPart = catalogPartSchema.parse({ id: snapshot.id, ...snapshot.data() })
    return {
      sku: `RFQ-${quote.id}`,
      title: catalogPart.name,
      partId: catalogPart.id,
      listingIdForItem: `rfq:${quote.id}`,
      hsnCode: catalogPart.hsnCode,
      gstRatePercent: catalogPart.gstRatePercent,
      weightGrams: DEFAULT_LISTING_WEIGHT_GRAMS,
      dimensionsCm: undefined,
      isOversized: false,
    }
  }

  if (quote.hsnCode && quote.gstRatePercent) {
    return {
      sku: `RFQ-${quote.id}`,
      title: rfq.freeTextDescription ?? 'RFQ item',
      partId: `rfq:${quote.id}`,
      listingIdForItem: `rfq:${quote.id}`,
      hsnCode: quote.hsnCode,
      gstRatePercent: quote.gstRatePercent,
      weightGrams: DEFAULT_LISTING_WEIGHT_GRAMS,
      dimensionsCm: undefined,
      isOversized: false,
    }
  }

  throw new HttpsError('failed-precondition', 'listing_or_part_required')
}

async function acceptQuote(buyerId: string, input: AcceptRfqQuoteRequest): Promise<AcceptRfqQuoteResult> {
  const db = getFirestore()

  const [buyerSnapshot, shippingAddressSnapshot, config, shippingConfig] = await Promise.all([
    db.collection('users').doc(buyerId).get(),
    db.collection('users').doc(buyerId).collection('addresses').doc(input.shippingAddressId).get(),
    getAppConfig(),
    getShippingConfig(),
  ])
  if (!buyerSnapshot.exists) throw new HttpsError('failed-precondition', 'buyer_profile_missing')
  const buyer = userSchema.parse({ id: buyerSnapshot.id, ...buyerSnapshot.data() })
  if (!shippingAddressSnapshot.exists) throw new HttpsError('not-found', 'shipping_address_not_found')
  const shippingAddress = addressSnapshotSchema.parse(shippingAddressSnapshot.data())
  if (!isValidStateCode(shippingAddress.stateCode)) throw new HttpsError('failed-precondition', 'buyer_state_unresolved')

  const [rfqSnapshot, quoteSnapshot] = await Promise.all([
    db.collection('rfqs').doc(input.rfqId).get(),
    db.collection('rfqQuotes').doc(input.quoteId).get(),
  ])
  if (!rfqSnapshot.exists) throw new HttpsError('not-found', 'rfq_not_found')
  const rfq = rfqSchema.parse({ id: rfqSnapshot.id, ...rfqSnapshot.data() })
  if (rfq.buyerId !== buyerId) throw new HttpsError('permission-denied', 'not_your_rfq')
  if (!quoteSnapshot.exists) throw new HttpsError('not-found', 'quote_not_found')
  const quote = rfqQuoteSchema.parse({ id: quoteSnapshot.id, ...quoteSnapshot.data() })
  if (quote.rfqId !== rfq.id) throw new HttpsError('invalid-argument', 'quote_rfq_mismatch')

  const sellerSnapshot = await db.collection('sellers').doc(quote.sellerId).get()
  if (!sellerSnapshot.exists) throw new HttpsError('failed-precondition', 'seller_unavailable')
  const seller: Seller = sellerSchema.parse({ id: sellerSnapshot.id, ...sellerSnapshot.data() })
  const sellerStateCode = seller.gstin.slice(0, 2)
  if (!isValidStateCode(sellerStateCode)) throw new HttpsError('failed-precondition', 'seller_state_unresolved')

  const anchor = await resolveTaxableAnchor(db, quote.sellerId, rfq, quote)

  const qty = quote.qtyOffered
  const unitPricePaise = quote.unitPricePaise
  const lineSubtotalPaise = unitPricePaise * qty
  const lineTaxPaise = seller.gstComposition ? 0 : applyPercent(lineSubtotalPaise, anchor.gstRatePercent)
  const lineTotalPaise = lineSubtotalPaise + lineTaxPaise

  const item: SubOrderItem = {
    listingId: anchor.listingIdForItem,
    partId: anchor.partId,
    sku: anchor.sku,
    title: anchor.title,
    qty,
    unitPricePaise,
    tierMinQtyApplied: qty,
    hsnCode: anchor.hsnCode,
    gstRatePercent: anchor.gstRatePercent,
    lineSubtotalPaise,
    lineDiscountPaise: 0,
    lineTaxPaise,
    lineTotalPaise,
  }

  const interState = isInterState(sellerStateCode, shippingAddress.stateCode)
  let cgstPaise = 0
  let sgstPaise = 0
  let igstPaise = 0
  if (interState) {
    igstPaise = lineTaxPaise
  } else {
    const [cgstShare, sgstShare] = splitProportionally(lineTaxPaise, [1, 1])
    cgstPaise = cgstShare ?? 0
    sgstPaise = sgstShare ?? 0
  }
  const taxPaise = cgstPaise + sgstPaise + igstPaise

  const zone = resolveShippingZone(sellerStateCode, shippingAddress.stateCode)
  const totalWeightGrams = qty * computeChargeableWeightGrams(anchor.weightGrams, anchor.dimensionsCm, shippingConfig.volumetricDivisorCm3PerKg)
  const freeShippingThresholdPaise = seller.freeShippingThresholdPaise ?? shippingConfig.freeShippingThresholdPaise
  const shippingEstimate = estimateSellerShipping(zone, totalWeightGrams, lineSubtotalPaise, shippingConfig, {
    isOversized: anchor.isOversized,
    freeShippingThresholdOverridePaise: freeShippingThresholdPaise,
  })

  let codFeePaise = 0
  let creditAccountId: string | undefined
  if (input.paymentMethod === 'cod') {
    const codRestricted = anchor.isOversized && shippingConfig.oversizedCodRestricted
    if (!config.codEnabled || !seller.codAvailable || codRestricted || buyer.codAbuseFlag) {
      throw new HttpsError('failed-precondition', 'cod_not_eligible')
    }
    codFeePaise = config.codFeePaise ?? 0
  }
  if (input.paymentMethod === 'credit_line') {
    const creditSnapshot = await db.collection('creditAccounts').where('buyerId', '==', buyerId).limit(1).get()
    const creditDoc = creditSnapshot.docs[0]
    if (!creditDoc) throw new HttpsError('failed-precondition', 'credit_not_eligible')
    const credit = creditAccountSchema.parse({ id: creditDoc.id, ...creditDoc.data() })
    const totalCheck = lineTotalPaise + shippingEstimate.shippingPaise
    if (credit.status !== 'active' || credit.availableCreditPaise < totalCheck) {
      throw new HttpsError('failed-precondition', 'credit_not_eligible')
    }
    if (config.codCapPaise !== undefined && codFeePaise > 0 && totalCheck > config.codCapPaise) {
      throw new HttpsError('failed-precondition', 'credit_not_eligible')
    }
    creditAccountId = creditDoc.id
  }

  const totalPaise = lineTotalPaise + shippingEstimate.shippingPaise + codFeePaise
  const now = Date.now()
  const isImmediatelyConfirmed = input.paymentMethod !== 'razorpay'
  const reservationExpiresAt = isImmediatelyConfirmed ? undefined : now + config.reservationExpiryMinutes * 60_000
  const sellerAcceptSlaMs = config.sellerAcceptSlaHours * 60 * 60_000

  const orderRef = db.collection('orders').doc()
  const subOrderRef = db.collection('subOrders').doc()
  const rfqRef = db.collection('rfqs').doc(rfq.id)
  const quoteRef = db.collection('rfqQuotes').doc(quote.id)
  const creditAccountRef = creditAccountId ? db.collection('creditAccounts').doc(creditAccountId) : undefined
  const sellerOwnerRef = db.collection('users').doc(seller.ownerUserId)

  await db.runTransaction(async (tx) => {
    // ---- reads (all reads must precede all writes) ----
    const freshRfqSnapshot = await tx.get(rfqRef)
    const freshQuoteSnapshot = await tx.get(quoteRef)
    const otherPendingSnapshot = await tx.get(
      db.collection('rfqQuotes').where('rfqId', '==', rfq.id).where('status', '==', 'pending'),
    )
    const creditSnapshot = creditAccountRef ? await tx.get(creditAccountRef) : undefined
    const sellerOwnerSnapshot = await tx.get(sellerOwnerRef)
    const otherSellerRefs = otherPendingSnapshot.docs
      .filter((doc) => doc.id !== quote.id)
      .map((doc) => db.collection('sellers').doc(doc.data().sellerId as string))
    const otherSellerSnapshots = await Promise.all(otherSellerRefs.map((ref) => tx.get(ref)))
    const otherOwnerRefs = otherSellerSnapshots
      .filter((s) => s.exists)
      .map((s) => db.collection('users').doc(s.data()?.ownerUserId as string))
    const otherOwnerSnapshots = await Promise.all(otherOwnerRefs.map((ref) => tx.get(ref)))

    // ---- validate against the freshest possible read, right before committing ----
    if (!freshRfqSnapshot.exists) throw new HttpsError('not-found', 'rfq_not_found')
    const freshRfq = rfqSchema.parse({ id: freshRfqSnapshot.id, ...freshRfqSnapshot.data() })
    if (freshRfq.status !== 'open' && freshRfq.status !== 'quoted') {
      throw new HttpsError('failed-precondition', 'rfq_not_acceptable')
    }
    if (!freshQuoteSnapshot.exists) throw new HttpsError('not-found', 'quote_not_found')
    const freshQuote = rfqQuoteSchema.parse({ id: freshQuoteSnapshot.id, ...freshQuoteSnapshot.data() })
    if (freshQuote.status !== 'pending') throw new HttpsError('failed-precondition', 'quote_not_pending')
    if (freshQuote.validUntil !== undefined && now > freshQuote.validUntil) {
      throw new HttpsError('failed-precondition', 'quote_expired')
    }
    if (creditAccountRef) {
      if (!creditSnapshot?.exists) throw new HttpsError('failed-precondition', 'credit_not_eligible')
      const credit = creditAccountSchema.parse({ id: creditSnapshot.id, ...creditSnapshot.data() })
      if (credit.status !== 'active' || credit.availableCreditPaise < totalPaise) {
        throw new HttpsError('failed-precondition', 'credit_not_eligible')
      }
    }

    const sellerOwnerLanguage: NotificationLanguage =
      (sellerOwnerSnapshot.exists ? sellerOwnerSnapshot.data()?.preferredLanguage : undefined) === 'hi' ? 'hi' : 'en'
    const ownerLanguageByUid = new Map<string, NotificationLanguage>()
    otherOwnerSnapshots.forEach((snapshot) => {
      const preferredLanguage = snapshot.exists ? snapshot.data()?.preferredLanguage : undefined
      ownerLanguageByUid.set(snapshot.id, preferredLanguage === 'hi' ? 'hi' : 'en')
    })
    const ownerUidBySellerId = new Map<string, string>()
    otherSellerSnapshots.forEach((snapshot) => {
      if (snapshot.exists) ownerUidBySellerId.set(snapshot.id, snapshot.data()?.ownerUserId as string)
    })

    // ---- writes: order + subOrder ----
    const orderStatus = isImmediatelyConfirmed ? 'confirmed' : 'pending_payment'
    const paymentStatus =
      input.paymentMethod === 'cod' ? 'pending' : input.paymentMethod === 'credit_line' ? 'authorized' : 'pending'

    const { id: _orderId, ...orderDoc } = orderSchema.parse({
      id: orderRef.id,
      buyerId,
      buyerType: buyer.buyerType ?? 'retail',
      status: orderStatus,
      subOrderIds: [subOrderRef.id],
      shippingAddress,
      billingGstin: input.billing?.isBusinessPurchase ? input.billing.gstin : undefined,
      billingLegalName: input.billing?.isBusinessPurchase ? input.billing.legalName : undefined,
      subtotalPaise: lineSubtotalPaise,
      discountPaise: 0,
      shippingPaise: shippingEstimate.shippingPaise,
      taxPaise,
      codFeePaise,
      totalPaise,
      paymentMethod: input.paymentMethod,
      paymentStatus,
      idempotencyKey: input.idempotencyKey,
      reservationExpiresAt,
      confirmedAt: isImmediatelyConfirmed ? now : undefined,
      placedAt: now,
      createdAt: now,
      updatedAt: now,
    })
    tx.set(orderRef, stripUndefined(orderDoc))

    const { id: _subOrderId, ...subOrderDoc } = subOrderSchema.parse({
      id: subOrderRef.id,
      orderId: orderRef.id,
      buyerId,
      sellerId: quote.sellerId,
      status: 'pending',
      shippingAddress,
      items: [item],
      subtotalPaise: lineSubtotalPaise,
      discountPaise: 0,
      taxPaise,
      shippingPaise: shippingEstimate.shippingPaise,
      totalPaise,
      isInterState: interState,
      cgstPaise,
      sgstPaise,
      igstPaise,
      etaDaysMin: shippingEstimate.etaDaysMin,
      etaDaysMax: shippingEstimate.etaDaysMax,
      slaAcceptByAt: isImmediatelyConfirmed ? now + sellerAcceptSlaMs : undefined,
      timeline: isImmediatelyConfirmed ? [{ status: 'pending' as const, actor: { type: 'system' as const }, at: now }] : undefined,
      createdAt: now,
      updatedAt: now,
    })
    tx.set(subOrderRef, stripUndefined(subOrderDoc))

    tx.update(quoteRef, { status: 'accepted', orderId: orderRef.id, updatedAt: now })
    tx.update(rfqRef, { status: 'converted', orderId: orderRef.id, acceptedQuoteId: quote.id, updatedAt: now })

    otherPendingSnapshot.docs
      .filter((doc) => doc.id !== quote.id)
      .forEach((doc) => {
        tx.update(doc.ref, { status: 'rejected', updatedAt: now })
        const sellerId = doc.data().sellerId as string
        const ownerUserId = ownerUidBySellerId.get(sellerId)
        if (!ownerUserId) return
        queueNotification(tx, db, {
          userId: ownerUserId,
          type: 'rfq_quote_rejected',
          language: ownerLanguageByUid.get(ownerUserId) ?? 'en',
          rfqId: rfq.id,
        })
      })

    queueNotification(tx, db, {
      userId: seller.ownerUserId,
      type: 'rfq_quote_accepted',
      language: sellerOwnerLanguage,
      rfqId: rfq.id,
    })

    if (creditAccountRef) {
      tx.update(creditAccountRef, {
        availableCreditPaise: FieldValue.increment(-totalPaise),
        outstandingPaise: FieldValue.increment(totalPaise),
        updatedAt: now,
      })
    }
  })

  if (!isImmediatelyConfirmed) {
    try {
      const razorpayKeyId = config.razorpayKeyId
      if (!razorpayKeyId) throw new Error('config/app.razorpayKeyId is not set')

      const rzpOrder = await createRazorpayOrder({
        keyId: razorpayKeyId,
        keySecret: RAZORPAY_KEY_SECRET.value(),
        amountPaise: totalPaise,
        receipt: orderRef.id,
        notes: { orderId: orderRef.id, buyerId, rfqId: rfq.id },
      })
      await orderRef.update({ razorpayOrderId: rzpOrder.id, updatedAt: Date.now() })

      return {
        orderId: orderRef.id,
        status: 'pending_payment',
        paymentMethod: 'razorpay',
        totalPaise,
        razorpay: { keyId: razorpayKeyId, gatewayOrderId: rzpOrder.id, amountPaise: totalPaise, currency: 'INR' },
      }
    } catch {
      // Unlike createOrder.ts, there's no stock reservation to release — RFQ
      // conversions never touch listings/{id}.stockQty/reservedStock (see
      // resolveTaxableAnchor's header comment). The order is left in
      // pending_payment; the buyer can retry payment or the RFQ stays
      // converted with an unpaid order, same as a regular checkout gateway
      // failure would leave things without releaseReservationAndCancel to
      // clean up anything RFQ-specific.
      throw new HttpsError('internal', 'payment_gateway_unavailable')
    }
  }

  return { orderId: orderRef.id, status: 'confirmed', paymentMethod: input.paymentMethod, totalPaise }
}

/**
 * Requirement 4: converts an accepted quote into a normal order with the
 * negotiated price locked as a one-off tier on the order line — never by
 * mutating the public listing. Wrapped in withIdempotency like
 * checkout/createOrder.ts so a retried "Accept" click never double-converts.
 */
export const acceptRfqQuote = onCall(
  { enforceAppCheck: true, region: 'asia-south1', secrets: [RAZORPAY_KEY_SECRET] },
  async (request): Promise<AcceptRfqQuoteResult> => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required')
    const buyerId = request.auth.uid

    const parsed = acceptRfqQuoteRequestSchema.safeParse(request.data)
    if (!parsed.success) throw new HttpsError('invalid-argument', 'A valid accept-quote request is required')
    const input = parsed.data

    if (input.billing?.isBusinessPurchase && (!input.billing.gstin || !input.billing.legalName)) {
      throw new HttpsError('invalid-argument', 'GSTIN and legal business name are required for a business purchase')
    }

    return withIdempotency(`acceptRfqQuote:${buyerId}:${input.idempotencyKey}`, 'acceptRfqQuote', buyerId, () =>
      acceptQuote(buyerId, input),
    )
  },
)
