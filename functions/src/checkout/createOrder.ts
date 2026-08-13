import type {
  AddressSnapshot,
  CreateOrderRequest,
  CreateOrderResult,
  PricedCartLine,
  Seller,
  SubOrderItem,
} from '@snapspare/shared'
import {
  addressSnapshotSchema,
  createOrderRequestSchema,
  creditAccountSchema,
  listingSchema,
  orderSchema,
  sellerSchema,
  subOrderSchema,
  userSchema,
} from '@snapspare/shared'
import { randomUUID } from 'node:crypto'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { getAppConfig } from './appConfig.js'
import { withIdempotency } from './idempotency.js'
import { createRazorpayOrder } from './razorpayClient.js'
import { RAZORPAY_KEY_SECRET } from './secrets.js'
import { releaseReservationAndCancel } from './stockReservation.js'
import { computePriceCart } from '../cart/priceCart.js'
import { checkOrderVelocity } from '../abuse/orderVelocity.js'
import { withSentry } from '../monitoring/withSentry.js'
import { queueNotificationDirect } from '../orders/notify.js'
import { resolveUserLanguage } from '../seller/notifyLanguage.js'
import { enforceRateLimit } from '../util/rateLimit.js'
import { stripUndefined } from '../util/stripUndefined.js'

interface VehicleContext {
  vehicleId: string
  vehicleLabel: string
}

/**
 * Vehicle context isn't part of pricing (computePriceCart never sees it) —
 * it's read straight off the buyer's persisted `carts/{buyerId}` doc here,
 * purely for denormalization onto the subOrder item so a later review can
 * auto-fill "Fitted to: X" (see reviewEligibilitySchema). Absent for
 * "buy now"/bulk-order-pad flows that never went through the persisted cart,
 * or when the buyer had no active vehicle selected at add-to-cart time.
 */
function toSubOrderItem(line: PricedCartLine, vehicleByListingId: Map<string, VehicleContext>): SubOrderItem {
  const vehicle = vehicleByListingId.get(line.listingId)
  return {
    listingId: line.listingId,
    partId: line.partId,
    sku: line.sku,
    title: line.title,
    qty: line.qty,
    unitPricePaise: line.unitPricePaise,
    tierMinQtyApplied: line.tierMinQtyApplied,
    hsnCode: line.hsnCode,
    gstRatePercent: line.gstRatePercent,
    lineSubtotalPaise: line.lineSubtotalPaise,
    lineDiscountPaise: line.lineDiscountPaise,
    lineTaxPaise: line.lineTaxPaise,
    lineTotalPaise: line.lineTotalPaise,
    // Omitted entirely (not set to undefined) when absent: this object goes
    // into subOrderSchema.parse() and straight into a Firestore array field,
    // which stripUndefined() can't reach (shallow only, see its doc comment)
    // — an explicit `vehicleId: undefined` inside an array element crashes
    // the write the same way an un-stripped top-level field would.
    ...(vehicle ? { vehicleId: vehicle.vehicleId, vehicleLabel: vehicle.vehicleLabel } : {}),
  }
}

async function placeOrder(buyerId: string, input: CreateOrderRequest): Promise<CreateOrderResult> {
  const db = getFirestore()

  const [buyerSnapshot, shippingAddressSnapshot, config, cartSnapshot] = await Promise.all([
    db.collection('users').doc(buyerId).get(),
    db.collection('users').doc(buyerId).collection('addresses').doc(input.shippingAddressId).get(),
    getAppConfig(),
    db.collection('carts').doc(buyerId).get(),
  ])

  if (!buyerSnapshot.exists) throw new HttpsError('failed-precondition', 'buyer_profile_missing')
  const buyer = userSchema.parse({ id: buyerSnapshot.id, ...buyerSnapshot.data() })

  const vehicleByListingId = new Map<string, VehicleContext>()
  if (cartSnapshot.exists) {
    const cartData = cartSnapshot.data() as { sellerGroups?: { items?: { listingId: string; vehicleId?: string; vehicleLabel?: string }[] }[] }
    for (const group of cartData.sellerGroups ?? []) {
      for (const item of group.items ?? []) {
        if (item.vehicleId && item.vehicleLabel) {
          vehicleByListingId.set(item.listingId, { vehicleId: item.vehicleId, vehicleLabel: item.vehicleLabel })
        }
      }
    }
  }

  if (!shippingAddressSnapshot.exists) throw new HttpsError('not-found', 'shipping_address_not_found')
  const shippingAddress = addressSnapshotSchema.parse(shippingAddressSnapshot.data())

  let billingAddress: AddressSnapshot | undefined
  if (input.billing?.billingAddressId) {
    const billingSnapshot = await db
      .collection('users')
      .doc(buyerId)
      .collection('addresses')
      .doc(input.billing.billingAddressId)
      .get()
    if (!billingSnapshot.exists) throw new HttpsError('not-found', 'billing_address_not_found')
    billingAddress = addressSnapshotSchema.parse(billingSnapshot.data())
  }

  const priced = await computePriceCart({
    items: input.items,
    couponCode: input.couponCode,
    pincode: shippingAddress.pincode,
    buyerType: buyer.buyerType,
  })

  if (priced.sellerGroups.length === 0) {
    throw new HttpsError('failed-precondition', 'cart_empty')
  }
  const cartChanged =
    priced.unavailableListingIds.length > 0 ||
    priced.sellerGroups.some((group) => group.items.some((item) => item.qty === 0 || item.warnings.length > 0))
  if (cartChanged) {
    throw new HttpsError('failed-precondition', 'cart_changed')
  }

  const sellerIds = priced.sellerGroups.map((group) => group.sellerId)
  const sellerSnapshots = await Promise.all(sellerIds.map((id) => db.collection('sellers').doc(id).get()))
  const sellerById = new Map<string, Seller>()
  for (const snapshot of sellerSnapshots) {
    if (!snapshot.exists) throw new HttpsError('failed-precondition', 'seller_unavailable')
    sellerById.set(snapshot.id, sellerSchema.parse({ id: snapshot.id, ...snapshot.data() }))
  }

  let codFeePaise = 0
  let creditAccountId: string | undefined

  if (input.paymentMethod === 'cod') {
    const allSellersAcceptCod = priced.sellerGroups.every((group) => sellerById.get(group.sellerId)?.codAvailable)
    const underCap = config.codCapPaise === undefined || priced.totalPaise <= config.codCapPaise
    const noOversizedRestriction = priced.sellerGroups.every((group) => !group.codRestricted)
    if (!config.codEnabled || !allSellersAcceptCod || !underCap || !noOversizedRestriction || buyer.codAbuseFlag) {
      throw new HttpsError('failed-precondition', 'cod_not_eligible')
    }
    codFeePaise = config.codFeePaise ?? 0
  }

  if (input.paymentMethod === 'credit_line') {
    const creditSnapshot = await db.collection('creditAccounts').where('buyerId', '==', buyerId).limit(1).get()
    const creditDoc = creditSnapshot.docs[0]
    if (!creditDoc) throw new HttpsError('failed-precondition', 'credit_not_eligible')
    const credit = creditAccountSchema.parse({ id: creditDoc.id, ...creditDoc.data() })
    if (credit.status !== 'active' || credit.availableCreditPaise < priced.totalPaise) {
      throw new HttpsError('failed-precondition', 'credit_not_eligible')
    }
    creditAccountId = creditDoc.id
  }

  const totalPaise = priced.totalPaise + codFeePaise
  const now = Date.now()
  // Phase 22 monitoring: one id per order, stamped on the order doc itself
  // and threaded through every downstream function's logs (payment capture,
  // shipping, invoicing, notifications) so a support engineer can pull this
  // order's full cross-function trace from Cloud Logging with one filter —
  // see order.ts's correlationId field for the full rationale.
  const correlationId = randomUUID()
  const isImmediatelyConfirmed = input.paymentMethod !== 'razorpay'
  const reservationExpiresAt = isImmediatelyConfirmed ? undefined : now + config.reservationExpiryMinutes * 60_000
  // Only immediately-confirmed (cod/credit_line) subOrders start their
  // seller-accept SLA clock right away — a razorpay subOrder's clock starts
  // at payment capture instead (see paymentTransition.ts), since the seller
  // has nothing to act on until the order is actually paid for.
  const sellerAcceptSlaMs = config.sellerAcceptSlaHours * 60 * 60_000

  const orderRef = db.collection('orders').doc()
  const subOrderRefs = priced.sellerGroups.map(() => db.collection('subOrders').doc())
  const creditAccountRef = creditAccountId ? db.collection('creditAccounts').doc(creditAccountId) : undefined

  await db.runTransaction(async (tx) => {
    // ---- reads (all reads must precede all writes in a Firestore transaction) ----
    const listingRefs = priced.sellerGroups.flatMap((group) =>
      group.items.map((item) => db.collection('listings').doc(item.listingId)),
    )
    const listingSnapshots = await Promise.all(listingRefs.map((ref) => tx.get(ref)))
    const creditSnapshot = creditAccountRef ? await tx.get(creditAccountRef) : undefined

    // ---- validate against the freshest possible read, right before committing ----
    let cursor = 0
    for (const group of priced.sellerGroups) {
      for (const item of group.items) {
        const snapshot = listingSnapshots[cursor]
        cursor += 1
        if (!snapshot?.exists) throw new HttpsError('failed-precondition', 'cart_changed')
        const listing = listingSchema.parse({ id: snapshot.id, ...snapshot.data() })
        const available = listing.stockQty - listing.reservedStock
        if (available < item.qty) throw new HttpsError('failed-precondition', 'insufficient_stock')
      }
    }
    if (creditAccountRef) {
      if (!creditSnapshot?.exists) throw new HttpsError('failed-precondition', 'credit_not_eligible')
      const credit = creditAccountSchema.parse({ id: creditSnapshot.id, ...creditSnapshot.data() })
      if (credit.status !== 'active' || credit.availableCreditPaise < totalPaise) {
        throw new HttpsError('failed-precondition', 'credit_not_eligible')
      }
    }

    // ---- writes: reserve (razorpay) or commit (cod/credit_line) stock ----
    cursor = 0
    let groupIndex = 0
    for (const group of priced.sellerGroups) {
      const subOrderRef = subOrderRefs[groupIndex]
      groupIndex += 1
      for (const item of group.items) {
        const ref = listingRefs[cursor]
        cursor += 1
        if (!ref) continue
        tx.update(
          ref,
          isImmediatelyConfirmed
            ? { stockQty: FieldValue.increment(-item.qty), updatedAt: now }
            : { reservedStock: FieldValue.increment(item.qty), updatedAt: now },
        )
        // A reservation (razorpay, not yet paid) isn't a real stock movement
        // yet — only an immediately-confirmed sale actually decrements
        // stockQty, so only that case gets a ledger entry (requirement 5).
        if (isImmediatelyConfirmed) {
          tx.set(db.collection('stockLedger').doc(), {
            listingId: item.listingId,
            sellerId: group.sellerId,
            deltaQty: -item.qty,
            reason: 'sale',
            referenceId: subOrderRef?.id,
            createdAt: now,
          })
        }
      }
    }

    // ---- writes: order + subOrders ----
    const subOrderIds = subOrderRefs.map((ref) => ref.id)
    const orderStatus = isImmediatelyConfirmed ? 'confirmed' : 'pending_payment'
    const paymentStatus =
      input.paymentMethod === 'cod' ? 'pending' : input.paymentMethod === 'credit_line' ? 'authorized' : 'pending'

    const { id: _orderId, ...orderDoc } = orderSchema.parse({
      id: orderRef.id,
      buyerId,
      buyerType: buyer.buyerType ?? 'retail',
      status: orderStatus,
      subOrderIds,
      shippingAddress,
      billingGstin: input.billing?.isBusinessPurchase ? input.billing.gstin : undefined,
      billingLegalName: input.billing?.isBusinessPurchase ? input.billing.legalName : undefined,
      billingAddress,
      subtotalPaise: priced.subtotalPaise,
      discountPaise: priced.discountPaise,
      shippingPaise: priced.shippingPaise,
      taxPaise: priced.taxPaise,
      codFeePaise,
      totalPaise,
      couponCode: priced.coupon?.status === 'applied' ? priced.coupon.code : undefined,
      paymentMethod: input.paymentMethod,
      paymentStatus,
      idempotencyKey: input.idempotencyKey,
      correlationId,
      reservationExpiresAt,
      confirmedAt: isImmediatelyConfirmed ? now : undefined,
      placedAt: now,
      createdAt: now,
      updatedAt: now,
    })
    tx.set(orderRef, stripUndefined(orderDoc))

    priced.sellerGroups.forEach((group, index) => {
      const subOrderRef = subOrderRefs[index]
      if (!subOrderRef) return
      const { id: _subOrderId, ...subOrderDoc } = subOrderSchema.parse({
        id: subOrderRef.id,
        orderId: orderRef.id,
        buyerId,
        sellerId: group.sellerId,
        status: 'pending',
        shippingAddress,
        items: group.items.map((line) => toSubOrderItem(line, vehicleByListingId)),
        purchasedPartIds: Array.from(new Set(group.items.map((item) => item.partId))),
        subtotalPaise: group.subtotalPaise,
        discountPaise: group.discountPaise,
        taxPaise: group.taxPaise,
        shippingPaise: group.shippingPaise,
        totalPaise: group.totalPaise,
        isInterState: group.isInterState,
        cgstPaise: group.cgstPaise,
        sgstPaise: group.sgstPaise,
        igstPaise: group.igstPaise,
        etaDaysMin: group.etaDaysMin,
        etaDaysMax: group.etaDaysMax,
        slaAcceptByAt: isImmediatelyConfirmed ? now + sellerAcceptSlaMs : undefined,
        timeline: isImmediatelyConfirmed
          ? [{ status: 'pending' as const, actor: { type: 'system' as const }, at: now }]
          : undefined,
        createdAt: now,
        updatedAt: now,
      })
      tx.set(subOrderRef, stripUndefined(subOrderDoc))
    })

    if (creditAccountRef) {
      tx.update(creditAccountRef, {
        availableCreditPaise: FieldValue.increment(-totalPaise),
        outstandingPaise: FieldValue.increment(totalPaise),
        updatedAt: now,
      })
    }
  })

  logger.info('createOrder: order placed', { orderId: orderRef.id, correlationId, buyerId, paymentMethod: input.paymentMethod })
  await checkOrderVelocity(db, buyerId, now)

  await queueNotificationDirect(db, {
    userId: buyerId,
    type: 'order_placed',
    language: buyer.preferredLanguage,
    orderId: orderRef.id,
  })

  // A razorpay subOrder isn't actionable by its seller until payment
  // capture (applyPaymentCaptured queues new_order_for_seller then instead)
  // — only cod/credit_line orders are actionable immediately.
  if (isImmediatelyConfirmed) {
    await Promise.all(
      priced.sellerGroups.map(async (group, index) => {
        const subOrderRef = subOrderRefs[index]
        const seller = sellerById.get(group.sellerId)
        if (!subOrderRef || !seller) return
        await queueNotificationDirect(db, {
          userId: seller.ownerUserId,
          type: 'new_order_for_seller',
          language: await resolveUserLanguage(db, seller.ownerUserId),
          orderId: orderRef.id,
          subOrderId: subOrderRef.id,
        })
      }),
    )
  }

  if (!isImmediatelyConfirmed) {
    try {
      const razorpayKeyId = config.razorpayKeyId
      if (!razorpayKeyId) throw new Error('config/app.razorpayKeyId is not set')

      const rzpOrder = await createRazorpayOrder({
        keyId: razorpayKeyId,
        keySecret: RAZORPAY_KEY_SECRET.value(),
        amountPaise: totalPaise,
        receipt: orderRef.id,
        notes: { orderId: orderRef.id, buyerId },
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
      await releaseReservationAndCancel(orderRef.id, 'gateway_error')
      throw new HttpsError('internal', 'payment_gateway_unavailable')
    }
  }

  return {
    orderId: orderRef.id,
    status: 'confirmed',
    paymentMethod: input.paymentMethod,
    totalPaise,
  }
}

/**
 * Places an order (Phase 8): re-runs priceCart server-side (never trusts the
 * client's last-seen total), reserves or commits stock in a transaction
 * (never oversells — see stockReservation.ts/listing.ts's reservedStock doc
 * comment), writes the order + per-seller subOrders, and for the Razorpay
 * path creates the gateway order the client needs to open Standard
 * Checkout. Wrapped in withIdempotency so a retried "Place order" click
 * (double-tap, flaky network) never double-reserves stock or double-creates
 * a Razorpay order.
 */
export const createOrder = onCall(
  { enforceAppCheck: true, region: 'asia-south1', secrets: [RAZORPAY_KEY_SECRET] },
  withSentry('createOrder', async (request): Promise<CreateOrderResult> => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required')
    const buyerId = request.auth.uid

    const parsed = createOrderRequestSchema.safeParse(request.data)
    if (!parsed.success) throw new HttpsError('invalid-argument', 'A valid order request is required')
    const input = parsed.data

    // 20/hour/uid, 40/hour/IP — generous for a legitimate bulk-order buyer
    // (garages/fleets can place several orders in a session) while capping
    // scripted checkout abuse (stock-reservation churn, gateway-order spam).
    await enforceRateLimit(request, { name: 'createOrder', perUidLimit: 20, perIpLimit: 40, windowMinutes: 60 })

    if (input.billing?.isBusinessPurchase && (!input.billing.gstin || !input.billing.legalName)) {
      throw new HttpsError('invalid-argument', 'GSTIN and legal business name are required for a business purchase')
    }

    return withIdempotency(`createOrder:${buyerId}:${input.idempotencyKey}`, 'createOrder', buyerId, () =>
      placeOrder(buyerId, input),
    )
  }),
)
