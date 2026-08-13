import { randomUUID } from 'node:crypto'
import {
  addressSchema,
  computeGstinCheckDigit,
  configSchema,
  listingSchema,
  pincodeMasterSchema,
  sellerSchema,
  userSchema,
} from '@snapspare/shared'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import type { CallableRequest } from 'firebase-functions/v2/https'
import { beforeAll, describe, expect, it } from 'vitest'
import { acceptSubOrder } from '../acceptSubOrder.js'
import { decideReturn } from '../decideReturn.js'
import { packSubOrder } from '../packSubOrder.js'
import { refundReturn } from '../refundReturn.js'
import { requestReturn } from '../requestReturn.js'
import { shipSubOrder } from '../shipSubOrder.js'
import { updateShipmentStatus } from '../updateShipmentStatus.js'
import { createOrder } from '../../checkout/createOrder.js'
import { applyPaymentCaptured } from '../../checkout/paymentTransition.js'
import { submitRefundBankDetails } from '../../payments/submitRefundBankDetails.js'
import { processSellerPayout, startOfUtcDay } from '../../payments/runSellerPayouts.js'

process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080'

initializeApp({ projectId: 'demo-snapspare' })
const db = getFirestore()

/**
 * End-to-end coverage of the buyer/seller/admin-visible order lifecycle
 * (Phase 23): place order -> ship -> deliver, then branching into the two
 * real "delivered" endings — seller payout, and return/refund — plus a
 * standalone check of the payment-capture ("webhook -> confirm") transition.
 * Run with `pnpm test:functions:emulator`.
 *
 * Every step below calls the REAL exported `onCall` function via its `.run()`
 * method (a documented Firebase testing hook that invokes the handler
 * directly against a `CallableRequest` you construct, bypassing HTTP/CORS/
 * App-Check dispatch — see firebase-functions' `CallableFunction.run()`), so
 * this exercises the actual production business logic, not a reimplementation
 * of it. Two things are deliberately stubbed rather than exercised live:
 *
 * 1. The Razorpay gateway call inside createOrder (paymentMethod: 'razorpay')
 *    hits a real external API and isn't reachable from this test — the
 *    "webhook -> confirm" scenario instead seeds a `pending_payment` order/
 *    subOrder directly (the exact state createOrder would have produced right
 *    before that gateway call) and exercises `applyPaymentCaptured`, the one
 *    function both the webhook and the client's confirmPayment fast-path
 *    funnel through — see paymentTransition.ts's doc comment.
 * 2. `applyCommissionOnDelivered` is a Firestore `onDocumentWritten` trigger,
 *    which doesn't fire in this test run (only the Firestore emulator, not
 *    the functions emulator, is active — see vitest.emulator.config.ts).
 *    Its commission/TCS/TDS math already has direct coverage
 *    (packages/shared/src/pricing/{commission,tax}.test.ts); this test
 *    instead writes the denormalized fields it would have produced
 *    (commissionPaise/netPayableToSellerPaise/payoutId) directly onto the
 *    subOrder once `delivered`, so the payout step downstream — which is
 *    what's actually under test here — has real, consistent input.
 */

const now = Date.now()

async function ensureAppConfig(): Promise<void> {
  const doc = configSchema.parse({
    id: 'app',
    platformCommissionDefaultPercent: 10,
    codEnabled: true,
    reservationExpiryMinutes: 15,
    sellerAcceptSlaHours: 24,
    defaultReturnWindowDays: 7,
    updatedAt: now,
  })
  await db.collection('config').doc('app').set(doc)
}

function freshId(prefix: string): string {
  return `${prefix}-${randomUUID()}`
}

function validGstin(stateCode: string): string {
  const first14 = `${stateCode}AAAAA0000A1Z`
  return `${first14}${computeGstinCheckDigit(first14)}`
}

interface BuyerFixture {
  buyerId: string
  addressId: string
}

async function seedBuyer(stateCode: '27' | '29', pincode: string): Promise<BuyerFixture> {
  const buyerId = freshId('buyer')
  const addressId = freshId('address')

  await db.collection('pincodes').doc(pincode).set(
    pincodeMasterSchema.parse({
      id: pincode,
      city: 'Test City',
      state: stateCode === '27' ? 'Maharashtra' : 'Karnataka',
      stateCode,
      createdAt: now,
      updatedAt: now,
    }),
  )

  await db
    .collection('users')
    .doc(buyerId)
    .set(
      userSchema.parse({
        id: buyerId,
        displayName: 'Test Buyer',
        roles: ['buyer'],
        primaryRole: 'buyer',
        buyerType: 'retail',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      }),
    )

  await db
    .collection('users')
    .doc(buyerId)
    .collection('addresses')
    .doc(addressId)
    .set(
      addressSchema.parse({
        id: addressId,
        userId: buyerId,
        label: 'Home',
        contactName: 'Test Buyer',
        contactPhone: '9876543210',
        line1: '1 Test Street',
        city: 'Test City',
        state: stateCode === '27' ? 'Maharashtra' : 'Karnataka',
        stateCode,
        pincode,
        isDefault: true,
        createdAt: now,
        updatedAt: now,
      }),
    )

  return { buyerId, addressId }
}

interface SellerFixture {
  sellerId: string
  ownerUserId: string
  listingId: string
}

async function seedSellerWithListing(stateCode: '27' | '29'): Promise<SellerFixture> {
  const sellerId = freshId('seller')
  const ownerUserId = freshId('sellerowner')
  const warehouseAddressId = freshId('address')
  const listingId = freshId('listing')

  await db
    .collection('users')
    .doc(ownerUserId)
    .set(
      userSchema.parse({
        id: ownerUserId,
        displayName: 'Test Seller Owner',
        roles: ['seller'],
        primaryRole: 'seller',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      }),
    )

  await db
    .collection('users')
    .doc(ownerUserId)
    .collection('addresses')
    .doc(warehouseAddressId)
    .set(
      addressSchema.parse({
        id: warehouseAddressId,
        userId: ownerUserId,
        label: 'Warehouse',
        contactName: 'Test Seller Owner',
        contactPhone: '9876500000',
        line1: '1 Industrial Estate',
        city: stateCode === '27' ? 'Mumbai' : 'Bengaluru',
        state: stateCode === '27' ? 'Maharashtra' : 'Karnataka',
        stateCode,
        pincode: stateCode === '27' ? '400001' : '560001',
        isDefault: true,
        createdAt: now,
        updatedAt: now,
      }),
    )

  await db
    .collection('sellers')
    .doc(sellerId)
    .set(
      sellerSchema.parse({
        id: sellerId,
        ownerUserId,
        businessName: 'Test Auto Parts Co',
        legalName: 'Test Auto Parts Co Pvt Ltd',
        gstin: validGstin(stateCode),
        pan: 'ABCDE1234F',
        businessType: 'proprietorship',
        status: 'active',
        warehouseAddressId,
        bankAccount: {
          accountHolderName: 'Test Auto Parts Co',
          accountNumber: '000123456789',
          ifsc: 'HDFC0000123',
          bankName: 'HDFC Bank',
        },
        codAvailable: true,
        createdAt: now,
        updatedAt: now,
      }),
    )

  await db
    .collection('listings')
    .doc(listingId)
    .set(
      listingSchema.parse({
        id: listingId,
        sellerId,
        partId: freshId('part'),
        sku: 'SKU-TEST-1',
        title: 'Test Brake Pad Set',
        condition: 'new',
        stockQty: 100,
        pricing: { moq: 1, stepQty: 1, tiers: [{ minQty: 1, maxQty: null, unitPricePaise: 1000_00 }] },
        taxIncluded: false,
        hsnCode: '87083000',
        gstRatePercent: 18,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      }),
    )

  return { sellerId, ownerUserId, listingId }
}

function buildRequest<T>(data: T, auth?: { uid: string; sellerId?: string; role?: string }): CallableRequest<T> {
  return {
    data,
    auth: auth
      ? {
          uid: auth.uid,
          token: { uid: auth.uid, sellerId: auth.sellerId, role: auth.role },
        }
      : undefined,
  } as unknown as CallableRequest<T>
}

beforeAll(async () => {
  await ensureAppConfig()
})

describe('order lifecycle: place order -> ship -> deliver -> payout (COD, inter-state)', () => {
  it('takes a COD order from placement through to a paid seller payout', async () => {
    const { buyerId, addressId } = await seedBuyer('29', '560001') // buyer in Karnataka
    const { sellerId, ownerUserId, listingId } = await seedSellerWithListing('27') // seller in Maharashtra -> inter-state

    const placeResult = await createOrder.run(
      buildRequest(
        {
          idempotencyKey: freshId('idem'),
          items: [{ listingId, qty: 2 }],
          shippingAddressId: addressId,
          paymentMethod: 'cod' as const,
        },
        { uid: buyerId },
      ),
    )
    expect(placeResult.status).toBe('confirmed')
    expect(placeResult.paymentMethod).toBe('cod')

    const orderSnapshot = await db.collection('orders').doc(placeResult.orderId).get()
    expect(orderSnapshot.data()?.status).toBe('confirmed')
    const subOrderId = (orderSnapshot.data()?.subOrderIds as string[])[0] as string

    const subOrderAfterPlace = await db.collection('subOrders').doc(subOrderId).get()
    expect(subOrderAfterPlace.data()?.isInterState).toBe(true)
    expect(subOrderAfterPlace.data()?.igstPaise).toBeGreaterThan(0)
    expect(subOrderAfterPlace.data()?.cgstPaise).toBe(0)
    expect(subOrderAfterPlace.data()?.sgstPaise).toBe(0)

    const listingAfterPlace = await db.collection('listings').doc(listingId).get()
    expect(listingAfterPlace.data()?.stockQty).toBe(98) // 100 - 2, committed immediately for COD

    const sellerAuth = { uid: ownerUserId, sellerId }

    const acceptResult = await acceptSubOrder.run(buildRequest({ subOrderId }, sellerAuth))
    expect(acceptResult.status).toBe('accepted')

    const packResult = await packSubOrder.run(buildRequest({ subOrderId }, sellerAuth))
    expect(packResult.status).toBe('packed')

    const shipResult = await shipSubOrder.run(buildRequest({ subOrderId, awb: 'AWB-TEST-1', courier: 'Delhivery' }, sellerAuth))
    expect(shipResult.status).toBe('shipped')

    const outForDeliveryResult = await updateShipmentStatus.run(
      buildRequest({ subOrderId, status: 'out_for_delivery' as const }, sellerAuth),
    )
    expect(outForDeliveryResult.status).toBe('out_for_delivery')

    const deliveredResult = await updateShipmentStatus.run(buildRequest({ subOrderId, status: 'delivered' as const }, sellerAuth))
    expect(deliveredResult.status).toBe('delivered')

    const subOrderAfterDelivery = await db.collection('subOrders').doc(subOrderId).get()
    expect(subOrderAfterDelivery.data()?.shipment?.deliveredAt).toBeDefined()

    // Stand-in for applyCommissionOnDelivered's Firestore trigger — see the
    // header comment. Uses the real subOrder's own money fields so the
    // payout math below reflects genuine order totals, not made-up numbers.
    const subOrderTotalPaise = subOrderAfterDelivery.data()?.totalPaise as number
    const subOrderShippingPaise = subOrderAfterDelivery.data()?.shippingPaise as number
    const netPayableToSellerPaise = subOrderTotalPaise - subOrderShippingPaise
    await db.collection('subOrders').doc(subOrderId).update({
      commissionPaise: 0,
      tcsPaise: 0,
      tdsPaise: 0,
      netPayableToSellerPaise,
      payoutId: null,
    })

    const periodTo = startOfUtcDay(Date.now())
    await processSellerPayout(db, sellerId, [subOrderId], periodTo)

    const payoutSnapshot = await db.collection('payouts').doc(`${sellerId}_${periodTo}`).get()
    expect(payoutSnapshot.exists).toBe(true)
    expect(payoutSnapshot.data()?.status).toBe('paid') // MockPayoutProvider always succeeds
    expect(payoutSnapshot.data()?.netAmountPaise).toBe(netPayableToSellerPaise)

    const subOrderAfterPayout = await db.collection('subOrders').doc(subOrderId).get()
    expect(subOrderAfterPayout.data()?.payoutId).toBe(`${sellerId}_${periodTo}`)
  })
})

describe('order lifecycle: place order -> ship -> deliver -> return -> refund (COD, intra-state)', () => {
  it('takes a delivered COD order through buyer-initiated return to a completed refund', async () => {
    const { buyerId, addressId } = await seedBuyer('27', '400002')
    const { sellerId, ownerUserId, listingId } = await seedSellerWithListing('27') // same state -> intra-state (CGST+SGST)

    const placeResult = await createOrder.run(
      buildRequest(
        {
          idempotencyKey: freshId('idem'),
          items: [{ listingId, qty: 1 }],
          shippingAddressId: addressId,
          paymentMethod: 'cod' as const,
        },
        { uid: buyerId },
      ),
    )
    expect(placeResult.status).toBe('confirmed')
    const orderSnapshot = await db.collection('orders').doc(placeResult.orderId).get()
    const subOrderId = (orderSnapshot.data()?.subOrderIds as string[])[0] as string

    const subOrderAfterPlace = await db.collection('subOrders').doc(subOrderId).get()
    expect(subOrderAfterPlace.data()?.isInterState).toBe(false)
    expect((subOrderAfterPlace.data()?.cgstPaise as number) + (subOrderAfterPlace.data()?.sgstPaise as number)).toBeGreaterThan(0)
    expect(subOrderAfterPlace.data()?.igstPaise).toBe(0)

    const sellerAuth = { uid: ownerUserId, sellerId }
    await acceptSubOrder.run(buildRequest({ subOrderId }, sellerAuth))
    await packSubOrder.run(buildRequest({ subOrderId }, sellerAuth))
    await shipSubOrder.run(buildRequest({ subOrderId, awb: 'AWB-TEST-2', courier: 'Delhivery' }, sellerAuth))
    await updateShipmentStatus.run(buildRequest({ subOrderId, status: 'out_for_delivery' as const }, sellerAuth))
    await updateShipmentStatus.run(buildRequest({ subOrderId, status: 'delivered' as const }, sellerAuth))

    // Same commission-trigger stand-in as the payout scenario above, plus
    // the order.paymentStatus flip applyCommissionOnDelivered would also
    // have made (this subOrder is the order's only one, so it's the moment
    // a COD order is considered "settled" and its cash collected) — needed
    // here specifically because refundReturn requires bank details on file
    // only once a COD order's paymentStatus is 'paid'.
    const subOrderAfterDelivery = await db.collection('subOrders').doc(subOrderId).get()
    await db.collection('subOrders').doc(subOrderId).update({
      commissionPaise: 0,
      tcsPaise: 0,
      tdsPaise: 0,
      netPayableToSellerPaise: subOrderAfterDelivery.data()?.totalPaise,
      payoutId: null,
    })
    await db.collection('orders').doc(placeResult.orderId).update({ paymentStatus: 'paid' })

    const returnResult = await requestReturn.run(
      buildRequest(
        {
          subOrderId,
          listingId,
          qty: 1,
          reason: 'changed_mind' as const,
          images: [] as string[],
          resolutionPreference: 'refund' as const,
        },
        { uid: buyerId },
      ),
    )
    const returnId = returnResult.returnId
    const returnAfterRequest = await db.collection('returns').doc(returnId).get()
    expect(returnAfterRequest.data()?.status).toBe('requested')

    const decideResult = await decideReturn.run(buildRequest({ returnId, decision: 'approved' as const }, sellerAuth))
    expect(decideResult.status).toBe('approved')

    await submitRefundBankDetails.run(
      buildRequest(
        {
          returnId,
          accountHolderName: 'Test Buyer',
          accountNumber: '11122233344',
          ifsc: 'ICIC0000456',
          bankName: 'ICICI Bank',
        },
        { uid: buyerId },
      ),
    )

    const listingBeforeRefund = await db.collection('listings').doc(listingId).get()
    expect(listingBeforeRefund.data()?.stockQty).toBe(99) // 100 - 1, not yet restored

    const refundResult = await refundReturn.run(buildRequest({ returnId }, sellerAuth))
    expect(refundResult.refundAmountPaise).toBeGreaterThan(0)

    const returnAfterRefund = await db.collection('returns').doc(returnId).get()
    expect(returnAfterRefund.data()?.status).toBe('refunded')
    expect(returnAfterRefund.data()?.refundAmountPaise).toBe(refundResult.refundAmountPaise)

    const subOrderAfterRefund = await db.collection('subOrders').doc(subOrderId).get()
    expect(subOrderAfterRefund.data()?.status).toBe('returned')

    const listingAfterRefund = await db.collection('listings').doc(listingId).get()
    expect(listingAfterRefund.data()?.stockQty).toBe(100) // restored by restoreStockInTx
  })
})

describe('payment capture transition ("webhook -> confirm")', () => {
  it('confirms a pending_payment razorpay order and commits its reserved stock once payment is captured', async () => {
    const { buyerId } = await seedBuyer('27', '400003')
    const { sellerId, listingId } = await seedSellerWithListing('27')

    // Reserve (not commit) stock the way createOrder's razorpay branch does,
    // then hand-seed the pending_payment order/subOrder it would have
    // produced right before the (unreachable-in-tests) gateway call — see
    // this file's header comment for why the gateway call itself isn't
    // exercised here.
    await db.collection('listings').doc(listingId).update({ reservedStock: 3 })

    const orderId = freshId('order')
    const subOrderId = freshId('suborder')
    const unitPricePaise = 1000_00
    const qty = 3
    const lineTotalPaise = unitPricePaise * qty

    await db
      .collection('orders')
      .doc(orderId)
      .set({
        id: orderId,
        buyerId,
        buyerType: 'retail',
        status: 'pending_payment',
        subOrderIds: [subOrderId],
        shippingAddress: {
          contactName: 'Test Buyer',
          contactPhone: '9876543210',
          line1: '1 Test Street',
          city: 'Mumbai',
          state: 'Maharashtra',
          stateCode: '27',
          pincode: '400003',
        },
        subtotalPaise: lineTotalPaise,
        discountPaise: 0,
        shippingPaise: 0,
        taxPaise: 0,
        codFeePaise: 0,
        totalPaise: lineTotalPaise,
        paymentMethod: 'razorpay',
        paymentStatus: 'pending',
        idempotencyKey: freshId('idem'),
        correlationId: freshId('corr'),
        reservationExpiresAt: Date.now() + 15 * 60_000,
        placedAt: now,
        createdAt: now,
        updatedAt: now,
      })

    await db
      .collection('subOrders')
      .doc(subOrderId)
      .set({
        id: subOrderId,
        orderId,
        buyerId,
        sellerId,
        status: 'pending',
        shippingAddress: {
          contactName: 'Test Buyer',
          contactPhone: '9876543210',
          line1: '1 Test Street',
          city: 'Mumbai',
          state: 'Maharashtra',
          stateCode: '27',
          pincode: '400003',
        },
        items: [
          {
            listingId,
            partId: freshId('part'),
            sku: 'SKU-TEST-1',
            title: 'Test Brake Pad Set',
            qty,
            unitPricePaise,
            tierMinQtyApplied: 1,
            hsnCode: '87083000',
            gstRatePercent: 18,
            lineSubtotalPaise: lineTotalPaise,
            lineDiscountPaise: 0,
            lineTaxPaise: 0,
            lineTotalPaise,
          },
        ],
        subtotalPaise: lineTotalPaise,
        discountPaise: 0,
        taxPaise: 0,
        shippingPaise: 0,
        totalPaise: lineTotalPaise,
        isInterState: false,
        cgstPaise: 0,
        sgstPaise: 0,
        igstPaise: 0,
        createdAt: now,
        updatedAt: now,
      })

    const gatewayPaymentId = freshId('pay')
    const outcome = await applyPaymentCaptured({
      orderId,
      gatewayOrderId: 'order_test_1',
      gatewayPaymentId,
      amountPaise: lineTotalPaise,
    })
    expect(outcome).toBe('confirmed')

    const orderAfterCapture = await db.collection('orders').doc(orderId).get()
    expect(orderAfterCapture.data()?.status).toBe('confirmed')
    expect(orderAfterCapture.data()?.paymentStatus).toBe('paid')

    const listingAfterCapture = await db.collection('listings').doc(listingId).get()
    // Reservation converts to a real sale: both stockQty and reservedStock drop by qty.
    expect(listingAfterCapture.data()?.stockQty).toBe(97)
    expect(listingAfterCapture.data()?.reservedStock).toBe(0)

    // A second delivery of the same gatewayPaymentId (a retried/duplicate
    // webhook) must be a pure no-op, not a second stock commit.
    const secondOutcome = await applyPaymentCaptured({
      orderId,
      gatewayOrderId: 'order_test_1',
      gatewayPaymentId,
      amountPaise: lineTotalPaise,
    })
    expect(secondOutcome).toBe('already_processed')

    const listingAfterDuplicate = await db.collection('listings').doc(listingId).get()
    expect(listingAfterDuplicate.data()?.stockQty).toBe(97) // unchanged
  })
})
