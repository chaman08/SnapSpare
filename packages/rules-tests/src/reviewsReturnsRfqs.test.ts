import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { createTestEnv } from './testEnv.js'

const BUYER_UID = 'buyer-1'
const OTHER_BUYER_UID = 'buyer-2'
const SELLER_UID = 'seller-1-owner'
const SELLER_ID = 'seller-1'
const OTHER_SELLER_UID = 'seller-2-owner'
const OTHER_SELLER_ID = 'seller-2'

const now = Date.now()
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

let testEnv: RulesTestEnvironment

beforeAll(async () => {
  testEnv = await createTestEnv()
})

afterAll(async () => {
  await testEnv.cleanup()
})

beforeEach(async () => {
  await testEnv.clearFirestore()
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore()

    await db.collection('reviewEligibility').doc(`${BUYER_UID}_listing-1`).set({
      buyerId: BUYER_UID,
      listingId: 'listing-1',
      partId: 'part-1',
      orderId: 'order-1',
      subOrderId: 'suborder-1',
      eligible: true,
      vehicleFitted: { vehicleId: 'vehicle-1', label: 'Maruti Suzuki Swift VDI 2018' },
      reminderSentAt: null,
      createdAt: now,
    })

    await db.collection('reviews').doc('review-recent').set({
      orderId: 'order-1',
      subOrderId: 'suborder-1',
      listingId: 'listing-1',
      partId: 'part-1',
      sellerId: SELLER_ID,
      buyerId: BUYER_UID,
      rating: 5,
      fitmentAccurate: true,
      qualityRating: 5,
      valueRating: 5,
      images: [],
      vehicleFitted: { vehicleId: 'vehicle-1', label: 'Maruti Suzuki Swift VDI 2018' },
      verifiedPurchase: true,
      status: 'pending',
      moderationStatus: 'clean',
      moderationFlags: [],
      createdAt: now,
      updatedAt: now,
    })
    await db.collection('reviews').doc('review-old').set({
      orderId: 'order-1',
      subOrderId: 'suborder-1',
      listingId: 'listing-1',
      partId: 'part-1',
      sellerId: SELLER_ID,
      buyerId: BUYER_UID,
      rating: 4,
      fitmentAccurate: true,
      qualityRating: 4,
      valueRating: 4,
      images: [],
      vehicleFitted: { vehicleId: 'vehicle-1', label: 'Maruti Suzuki Swift VDI 2018' },
      verifiedPurchase: true,
      status: 'published',
      moderationStatus: 'clean',
      moderationFlags: [],
      createdAt: now - SEVEN_DAYS_MS - 86_400_000,
      updatedAt: now - SEVEN_DAYS_MS - 86_400_000,
    })

    await db.collection('returns').doc('return-1').set({
      orderId: 'order-1',
      subOrderId: 'suborder-1',
      buyerId: BUYER_UID,
      sellerId: SELLER_ID,
      listingId: 'listing-1',
      qty: 1,
      reason: 'defective',
      resolutionPreference: 'refund',
      status: 'requested',
      images: [],
      requestedAt: now,
      createdAt: now,
      updatedAt: now,
    })

    await db.collection('warrantyClaims').doc('claim-1').set({
      orderId: 'order-1',
      subOrderId: 'suborder-1',
      listingId: 'listing-1',
      partId: 'part-1',
      partNumber: 'PN-1',
      buyerId: BUYER_UID,
      sellerId: SELLER_ID,
      reason: 'premature_failure',
      description: 'Stopped working after two weeks',
      evidenceImages: ['users/buyer-1/warrantyClaims/claim-1/photo1.jpg'],
      status: 'submitted',
      claimedAt: now,
      createdAt: now,
      updatedAt: now,
    })

    await db.collection('disputes').doc('dispute-1').set({
      type: 'return_qc',
      returnId: 'return-1',
      orderId: 'order-1',
      subOrderId: 'suborder-1',
      buyerId: BUYER_UID,
      sellerId: SELLER_ID,
      openedBy: 'buyer',
      reasonNotes: 'Seller says no damage found but the part arrived cracked',
      evidence: [],
      status: 'open',
      slaBreachAt: now + 48 * 60 * 60 * 1000,
      createdAt: now,
      updatedAt: now,
    })

    await db.collection('rfqs').doc('rfq-1').set({
      buyerId: BUYER_UID,
      buyerType: 'garage',
      partId: 'part-1',
      qtyRequested: 50,
      deliveryPincode: '400001',
      status: 'open',
      attachments: [],
      routedSellerIds: [SELLER_ID],
      quoteCount: 1,
      createdAt: now,
      updatedAt: now,
    })
    await db.collection('rfqQuotes').doc('quote-1').set({
      rfqId: 'rfq-1',
      sellerId: SELLER_ID,
      buyerId: BUYER_UID,
      unitPricePaise: 10000,
      qtyOffered: 50,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    })
    await db.collection('rfqQuotes').doc('quote-1').collection('messages').doc('message-1').set({
      rfqId: 'rfq-1',
      quoteId: 'quote-1',
      buyerId: BUYER_UID,
      sellerId: SELLER_ID,
      senderRole: 'buyer',
      senderId: BUYER_UID,
      body: 'Can you deliver by next Friday?',
      attachments: [],
      createdAt: now,
    })
  })
})

describe('reviews', () => {
  it('lets anyone read a published review', async () => {
    const db = testEnv.unauthenticatedContext().firestore()
    await assertSucceeds(db.collection('reviews').doc('review-old').get())
  })

  it('denies public read of a still-pending review', async () => {
    const db = testEnv.unauthenticatedContext().firestore()
    await assertFails(db.collection('reviews').doc('review-recent').get())
  })

  it('lets a buyer create a review when a reviewEligibility doc marks them eligible', async () => {
    const db = testEnv.authenticatedContext(BUYER_UID).firestore()
    await assertSucceeds(
      db.collection('reviews').doc('review-new').set({
        orderId: 'order-1',
        subOrderId: 'suborder-1',
        listingId: 'listing-1',
        partId: 'part-1',
        sellerId: SELLER_ID,
        buyerId: BUYER_UID,
        rating: 5,
        fitmentAccurate: true,
        qualityRating: 5,
        valueRating: 5,
        images: [],
        vehicleFitted: { vehicleId: 'vehicle-1', label: 'Maruti Suzuki Swift VDI 2018' },
        verifiedPurchase: true,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      }),
    )
  })

  it('denies creating a review without a matching reviewEligibility doc', async () => {
    const db = testEnv.authenticatedContext(OTHER_BUYER_UID).firestore()
    await assertFails(
      db.collection('reviews').doc('review-unearned').set({
        orderId: 'order-9',
        subOrderId: 'suborder-9',
        listingId: 'listing-9',
        partId: 'part-9',
        sellerId: SELLER_ID,
        buyerId: OTHER_BUYER_UID,
        rating: 5,
        fitmentAccurate: true,
        qualityRating: 5,
        valueRating: 5,
        images: [],
        verifiedPurchase: true,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      }),
    )
  })

  it("denies creating a review with a partId that doesn't match the reviewEligibility doc", async () => {
    const db = testEnv.authenticatedContext(BUYER_UID).firestore()
    await assertFails(
      db.collection('reviews').doc('review-wrong-part').set({
        orderId: 'order-1',
        subOrderId: 'suborder-1',
        listingId: 'listing-1',
        partId: 'part-wrong',
        sellerId: SELLER_ID,
        buyerId: BUYER_UID,
        rating: 5,
        fitmentAccurate: true,
        qualityRating: 5,
        valueRating: 5,
        images: [],
        vehicleFitted: { vehicleId: 'vehicle-1', label: 'Maruti Suzuki Swift VDI 2018' },
        verifiedPurchase: true,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      }),
    )
  })

  it("denies creating a review with a vehicleFitted that doesn't match the reviewEligibility doc", async () => {
    const db = testEnv.authenticatedContext(BUYER_UID).firestore()
    await assertFails(
      db.collection('reviews').doc('review-wrong-vehicle').set({
        orderId: 'order-1',
        subOrderId: 'suborder-1',
        listingId: 'listing-1',
        partId: 'part-1',
        sellerId: SELLER_ID,
        buyerId: BUYER_UID,
        rating: 5,
        fitmentAccurate: true,
        qualityRating: 5,
        valueRating: 5,
        images: [],
        vehicleFitted: { vehicleId: 'vehicle-9', label: 'Someone Else Car' },
        verifiedPurchase: true,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      }),
    )
  })

  it('denies creating a review with more than 4 images', async () => {
    const db = testEnv.authenticatedContext(BUYER_UID).firestore()
    await assertFails(
      db.collection('reviews').doc('review-too-many-photos').set({
        orderId: 'order-1',
        subOrderId: 'suborder-1',
        listingId: 'listing-1',
        partId: 'part-1',
        sellerId: SELLER_ID,
        buyerId: BUYER_UID,
        rating: 5,
        fitmentAccurate: true,
        qualityRating: 5,
        valueRating: 5,
        images: ['a', 'b', 'c', 'd', 'e'],
        vehicleFitted: { vehicleId: 'vehicle-1', label: 'Maruti Suzuki Swift VDI 2018' },
        verifiedPurchase: true,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      }),
    )
  })

  it('lets the author edit their review within the 7-day edit window', async () => {
    const db = testEnv.authenticatedContext(BUYER_UID).firestore()
    await assertSucceeds(
      db.collection('reviews').doc('review-recent').update({ rating: 4, updatedAt: Date.now() }),
    )
  })

  it('denies the author editing their review after the edit window has closed', async () => {
    const db = testEnv.authenticatedContext(BUYER_UID).firestore()
    await assertFails(db.collection('reviews').doc('review-old').update({ rating: 1 }))
  })

  it("denies another buyer editing someone else's review", async () => {
    const db = testEnv.authenticatedContext(OTHER_BUYER_UID).firestore()
    await assertFails(db.collection('reviews').doc('review-recent').update({ rating: 1 }))
  })

  it('denies the author reassigning sellerId/listingId on update', async () => {
    const db = testEnv.authenticatedContext(BUYER_UID).firestore()
    await assertFails(db.collection('reviews').doc('review-recent').update({ sellerId: OTHER_SELLER_ID }))
  })
})

describe('returns — participants only', () => {
  it('lets the buyer and the subOrder seller read the return', async () => {
    const buyerDb = testEnv.authenticatedContext(BUYER_UID).firestore()
    await assertSucceeds(buyerDb.collection('returns').doc('return-1').get())

    const sellerDb = testEnv.authenticatedContext(SELLER_UID, { role: 'seller', sellerId: SELLER_ID }).firestore()
    await assertSucceeds(sellerDb.collection('returns').doc('return-1').get())
  })

  it('denies an unrelated buyer or seller reading the return', async () => {
    const otherBuyerDb = testEnv.authenticatedContext(OTHER_BUYER_UID).firestore()
    await assertFails(otherBuyerDb.collection('returns').doc('return-1').get())

    const otherSellerDb = testEnv
      .authenticatedContext(OTHER_SELLER_UID, { role: 'seller', sellerId: OTHER_SELLER_ID })
      .firestore()
    await assertFails(otherSellerDb.collection('returns').doc('return-1').get())
  })

  it('lets the buyer create a fresh requested return', async () => {
    const db = testEnv.authenticatedContext(BUYER_UID).firestore()
    await assertSucceeds(
      db.collection('returns').doc('return-new').set({
        orderId: 'order-1',
        subOrderId: 'suborder-1',
        buyerId: BUYER_UID,
        sellerId: SELLER_ID,
        listingId: 'listing-1',
        qty: 1,
        reason: 'defective',
        resolutionPreference: 'refund',
        status: 'requested',
        images: [],
        requestedAt: now,
        createdAt: now,
        updatedAt: now,
      }),
    )
  })

  // Phase 18: approve/reject books a reverse pickup and QC pass/dispute
  // triggers a refund or replacement sub-order — real side effects that
  // must go through decideReturn.ts/submitReturnQc.ts now. The seller's
  // old direct-client approve path is gone.
  it('denies the seller updating the return directly, even a status-only change', async () => {
    const db = testEnv.authenticatedContext(SELLER_UID, { role: 'seller', sellerId: SELLER_ID }).firestore()
    await assertFails(db.collection('returns').doc('return-1').update({ status: 'approved' }))
  })

  it('denies the buyer updating their own still-requested return directly', async () => {
    const db = testEnv.authenticatedContext(BUYER_UID).firestore()
    await assertFails(db.collection('returns').doc('return-1').update({ reasonNotes: 'adding more detail' }))
  })

  it('denies an admin updating a return directly (Cloud-Function-only, even for admins)', async () => {
    const db = testEnv.authenticatedContext('admin-1', { role: 'admin' }).firestore()
    await assertFails(db.collection('returns').doc('return-1').update({ status: 'approved' }))
  })
})

describe('warrantyClaims — participants only, Cloud-Function-only writes', () => {
  it('lets the buyer and the claimed-against seller read the claim', async () => {
    const buyerDb = testEnv.authenticatedContext(BUYER_UID).firestore()
    await assertSucceeds(buyerDb.collection('warrantyClaims').doc('claim-1').get())

    const sellerDb = testEnv.authenticatedContext(SELLER_UID, { role: 'seller', sellerId: SELLER_ID }).firestore()
    await assertSucceeds(sellerDb.collection('warrantyClaims').doc('claim-1').get())
  })

  it('denies an unrelated buyer or seller reading the claim', async () => {
    const otherBuyerDb = testEnv.authenticatedContext(OTHER_BUYER_UID).firestore()
    await assertFails(otherBuyerDb.collection('warrantyClaims').doc('claim-1').get())

    const otherSellerDb = testEnv
      .authenticatedContext(OTHER_SELLER_UID, { role: 'seller', sellerId: OTHER_SELLER_ID })
      .firestore()
    await assertFails(otherSellerDb.collection('warrantyClaims').doc('claim-1').get())
  })

  it('denies a direct client create, even by the buyer (must go through submitWarrantyClaim)', async () => {
    const db = testEnv.authenticatedContext(BUYER_UID).firestore()
    await assertFails(
      db.collection('warrantyClaims').doc('claim-new').set({
        orderId: 'order-1',
        subOrderId: 'suborder-1',
        listingId: 'listing-1',
        partId: 'part-1',
        partNumber: 'PN-1',
        buyerId: BUYER_UID,
        sellerId: SELLER_ID,
        reason: 'premature_failure',
        description: 'Failed early',
        evidenceImages: ['x'],
        status: 'submitted',
        claimedAt: now,
        createdAt: now,
        updatedAt: now,
      }),
    )
  })

  it('denies the seller updating the claim directly (must go through decideWarrantyClaim)', async () => {
    const db = testEnv.authenticatedContext(SELLER_UID, { role: 'seller', sellerId: SELLER_ID }).firestore()
    await assertFails(db.collection('warrantyClaims').doc('claim-1').update({ status: 'approved' }))
  })
})

describe('disputes — participants only, Cloud-Function-only writes', () => {
  it('lets the buyer and the disputed seller read the dispute', async () => {
    const buyerDb = testEnv.authenticatedContext(BUYER_UID).firestore()
    await assertSucceeds(buyerDb.collection('disputes').doc('dispute-1').get())

    const sellerDb = testEnv.authenticatedContext(SELLER_UID, { role: 'seller', sellerId: SELLER_ID }).firestore()
    await assertSucceeds(sellerDb.collection('disputes').doc('dispute-1').get())
  })

  it('denies an unrelated buyer or seller reading the dispute', async () => {
    const otherBuyerDb = testEnv.authenticatedContext(OTHER_BUYER_UID).firestore()
    await assertFails(otherBuyerDb.collection('disputes').doc('dispute-1').get())

    const otherSellerDb = testEnv
      .authenticatedContext(OTHER_SELLER_UID, { role: 'seller', sellerId: OTHER_SELLER_ID })
      .firestore()
    await assertFails(otherSellerDb.collection('disputes').doc('dispute-1').get())
  })

  it('denies a direct client create, even by the buyer (must go through openDispute — server must validate the linked return/claim state)', async () => {
    const db = testEnv.authenticatedContext(BUYER_UID).firestore()
    await assertFails(
      db.collection('disputes').doc('dispute-new').set({
        type: 'return_qc',
        returnId: 'return-1',
        orderId: 'order-1',
        subOrderId: 'suborder-1',
        buyerId: BUYER_UID,
        sellerId: SELLER_ID,
        openedBy: 'buyer',
        reasonNotes: 'Disagree with QC outcome',
        evidence: [],
        status: 'open',
        slaBreachAt: now + 48 * 60 * 60 * 1000,
        createdAt: now,
        updatedAt: now,
      }),
    )
  })

  it('denies an admin resolving a dispute directly (must go through resolveDispute — the mandatory note/ledger debit can only be enforced server-side)', async () => {
    const db = testEnv.authenticatedContext('admin-1', { role: 'admin' }).firestore()
    await assertFails(db.collection('disputes').doc('dispute-1').update({ status: 'resolved' }))
  })
})

describe('rfqs / rfqQuotes — Cloud-Function-only writes', () => {
  it('lets the owning buyer and any signed-in seller read an rfq', async () => {
    const buyerDb = testEnv.authenticatedContext(BUYER_UID).firestore()
    await assertSucceeds(buyerDb.collection('rfqs').doc('rfq-1').get())

    const sellerDb = testEnv
      .authenticatedContext(OTHER_SELLER_UID, { role: 'seller', sellerId: OTHER_SELLER_ID })
      .firestore()
    await assertSucceeds(sellerDb.collection('rfqs').doc('rfq-1').get())
  })

  it('denies a signed-out read of an rfq', async () => {
    const db = testEnv.unauthenticatedContext().firestore()
    await assertFails(db.collection('rfqs').doc('rfq-1').get())
  })

  it('denies any direct client write to an rfq, even by its owning buyer', async () => {
    const buyerDb = testEnv.authenticatedContext(BUYER_UID).firestore()
    await assertFails(buyerDb.collection('rfqs').doc('rfq-1').update({ status: 'withdrawn' }))
    await assertFails(
      buyerDb.collection('rfqs').doc('new-rfq').set({
        buyerId: BUYER_UID,
        buyerType: 'garage',
        partId: 'part-1',
        qtyRequested: 50,
        deliveryPincode: '400001',
        status: 'open',
        attachments: [],
        createdAt: now,
        updatedAt: now,
      }),
    )
  })

  it('lets the quoting seller and the owning buyer read a quote', async () => {
    const sellerDb = testEnv.authenticatedContext(SELLER_UID, { role: 'seller', sellerId: SELLER_ID }).firestore()
    await assertSucceeds(sellerDb.collection('rfqQuotes').doc('quote-1').get())

    const buyerDb = testEnv.authenticatedContext(BUYER_UID).firestore()
    await assertSucceeds(buyerDb.collection('rfqQuotes').doc('quote-1').get())
  })

  it('denies an unrelated seller reading a quote that is not theirs', async () => {
    const db = testEnv
      .authenticatedContext(OTHER_SELLER_UID, { role: 'seller', sellerId: OTHER_SELLER_ID })
      .firestore()
    await assertFails(db.collection('rfqQuotes').doc('quote-1').get())
  })

  it('denies a seller submitting a quote directly (must go through submitRfqQuote)', async () => {
    const db = testEnv.authenticatedContext(SELLER_UID, { role: 'seller', sellerId: SELLER_ID }).firestore()
    await assertFails(
      db.collection('rfqQuotes').doc('new-quote').set({
        rfqId: 'rfq-1',
        sellerId: SELLER_ID,
        buyerId: BUYER_UID,
        unitPricePaise: 9000,
        qtyOffered: 50,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      }),
    )
  })

  it('denies the buyer accepting a quote directly (must go through acceptRfqQuote)', async () => {
    const db = testEnv.authenticatedContext(BUYER_UID).firestore()
    await assertFails(db.collection('rfqQuotes').doc('quote-1').update({ status: 'accepted' }))
  })

  it('denies the seller withdrawing their own quote directly (must go through withdrawRfqQuote)', async () => {
    const db = testEnv.authenticatedContext(SELLER_UID, { role: 'seller', sellerId: SELLER_ID }).firestore()
    await assertFails(db.collection('rfqQuotes').doc('quote-1').update({ status: 'withdrawn' }))
  })
})

describe('rfqQuotes/{quoteId}/messages — participants only, Cloud-Function-only writes', () => {
  it('lets the buyer and the quoting seller read a message', async () => {
    const buyerDb = testEnv.authenticatedContext(BUYER_UID).firestore()
    await assertSucceeds(buyerDb.collection('rfqQuotes').doc('quote-1').collection('messages').doc('message-1').get())

    const sellerDb = testEnv.authenticatedContext(SELLER_UID, { role: 'seller', sellerId: SELLER_ID }).firestore()
    await assertSucceeds(
      sellerDb.collection('rfqQuotes').doc('quote-1').collection('messages').doc('message-1').get(),
    )
  })

  it('denies an unrelated seller reading a thread that is not theirs', async () => {
    const db = testEnv
      .authenticatedContext(OTHER_SELLER_UID, { role: 'seller', sellerId: OTHER_SELLER_ID })
      .firestore()
    await assertFails(db.collection('rfqQuotes').doc('quote-1').collection('messages').doc('message-1').get())
  })

  it('denies a direct client write to a message, even by a genuine participant (moderation must run server-side)', async () => {
    const buyerDb = testEnv.authenticatedContext(BUYER_UID).firestore()
    await assertFails(
      buyerDb.collection('rfqQuotes').doc('quote-1').collection('messages').doc('new-message').set({
        rfqId: 'rfq-1',
        quoteId: 'quote-1',
        buyerId: BUYER_UID,
        sellerId: SELLER_ID,
        senderRole: 'buyer',
        senderId: BUYER_UID,
        body: 'Hello',
        attachments: [],
        createdAt: now,
      }),
    )
  })
})
