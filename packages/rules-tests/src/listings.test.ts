import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { createTestEnv } from './testEnv.js'

const SELLER_A_UID = 'seller-a-owner'
const SELLER_A_ID = 'seller-a'
const SELLER_B_UID = 'seller-b-owner'
const SELLER_B_ID = 'seller-b'
const BUYER_UID = 'buyer-1'
const ADMIN_UID = 'admin-1'

const now = 1_700_000_000_000

function baseListing(overrides: Record<string, unknown> = {}) {
  return {
    sellerId: SELLER_A_ID,
    partId: 'part-1',
    sku: 'SKU-1',
    title: 'Brake Pad Set',
    condition: 'new',
    stockQty: 100,
    pricing: { moq: 1, tiers: [{ minQty: 1, maxQty: null, unitPricePaise: 50000 }] },
    taxIncluded: true,
    hsnCode: '8708',
    gstRatePercent: 28,
    status: 'active',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

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
    await db.collection('listings').doc('listing-active').set(baseListing({ status: 'active' }))
    await db
      .collection('listings')
      .doc('listing-blocked')
      .set(baseListing({ status: 'rejected', sellerId: SELLER_A_ID }))
    await db
      .collection('listings')
      .doc('listing-b')
      .set(baseListing({ sellerId: SELLER_B_ID, status: 'active' }))
  })
})

describe('listings/{listingId} read', () => {
  it('lets anyone (including signed-out) read an active listing', async () => {
    const db = testEnv.unauthenticatedContext().firestore()
    await assertSucceeds(db.collection('listings').doc('listing-active').get())
  })

  it('denies public read of a blocked (non-active) listing', async () => {
    const db = testEnv.unauthenticatedContext().firestore()
    await assertFails(db.collection('listings').doc('listing-blocked').get())
  })

  it('lets the owning seller read their own blocked listing', async () => {
    const db = testEnv.authenticatedContext(SELLER_A_UID, { role: 'seller', sellerId: SELLER_A_ID }).firestore()
    await assertSucceeds(db.collection('listings').doc('listing-blocked').get())
  })

  it("denies a different seller reading another seller's blocked listing", async () => {
    const db = testEnv.authenticatedContext(SELLER_B_UID, { role: 'seller', sellerId: SELLER_B_ID }).firestore()
    await assertFails(db.collection('listings').doc('listing-blocked').get())
  })

  it('lets an admin read a blocked listing', async () => {
    const db = testEnv.authenticatedContext(ADMIN_UID, { role: 'admin' }).firestore()
    await assertSucceeds(db.collection('listings').doc('listing-blocked').get())
  })
})

// Phase 14: seller-initiated create/update now goes exclusively through the
// saveListing/updateListingStatus callables (Admin SDK, bypasses these rules
// entirely) — persistListing.ts is the actual enforcement point for
// listingPricingSchema's deep tier-ladder invariants, which these rules can
// only shallow-check. Direct client writes are admin-only now, for
// moderation. See firestore.rules' comment on match /listings/{listingId}.
describe('listings/{listingId} write', () => {
  it('denies a seller creating a listing directly, even under their own sellerId', async () => {
    const db = testEnv.authenticatedContext(SELLER_A_UID, { role: 'seller', sellerId: SELLER_A_ID }).firestore()
    await assertFails(db.collection('listings').doc('new-listing').set(baseListing()))
  })

  it("denies a seller creating a listing under another seller's sellerId", async () => {
    const db = testEnv.authenticatedContext(SELLER_A_UID, { role: 'seller', sellerId: SELLER_A_ID }).firestore()
    await assertFails(
      db.collection('listings').doc('new-listing').set(baseListing({ sellerId: SELLER_B_ID })),
    )
  })

  it('denies a seller updating their own listing directly (must go through saveListing)', async () => {
    const db = testEnv.authenticatedContext(SELLER_A_UID, { role: 'seller', sellerId: SELLER_A_ID }).firestore()
    await assertFails(
      db
        .collection('listings')
        .doc('listing-active')
        .set(baseListing({ status: 'active', stockQty: 50 })),
    )
  })

  it("denies a seller editing another seller's listing", async () => {
    const db = testEnv.authenticatedContext(SELLER_A_UID, { role: 'seller', sellerId: SELLER_A_ID }).firestore()
    await assertFails(
      db.collection('listings').doc('listing-b').set(baseListing({ sellerId: SELLER_B_ID, stockQty: 0 })),
    )
  })

  it('denies a seller reassigning their listing to a different sellerId', async () => {
    const db = testEnv.authenticatedContext(SELLER_A_UID, { role: 'seller', sellerId: SELLER_A_ID }).firestore()
    await assertFails(
      db.collection('listings').doc('listing-active').set(baseListing({ sellerId: SELLER_B_ID })),
    )
  })

  it('denies a buyer creating or editing any listing', async () => {
    const db = testEnv.authenticatedContext(BUYER_UID).firestore()
    await assertFails(db.collection('listings').doc('buyer-listing').set(baseListing()))
    await assertFails(db.collection('listings').doc('listing-active').set(baseListing({ stockQty: 1 })))
  })

  it('lets an admin create a listing directly', async () => {
    const db = testEnv.authenticatedContext(ADMIN_UID, { role: 'admin' }).firestore()
    await assertSucceeds(db.collection('listings').doc('admin-created').set(baseListing()))
  })

  it('lets an admin update (block) any listing', async () => {
    const db = testEnv.authenticatedContext(ADMIN_UID, { role: 'admin' }).firestore()
    await assertSucceeds(
      db.collection('listings').doc('listing-active').set(baseListing({ status: 'rejected' })),
    )
  })

  it('denies an admin write with a negative stockQty (listingFieldsValid still applies)', async () => {
    const db = testEnv.authenticatedContext(ADMIN_UID, { role: 'admin' }).firestore()
    await assertFails(
      db.collection('listings').doc('new-listing').set(baseListing({ stockQty: -1 })),
    )
  })

  it('denies an admin write with an out-of-range gstRatePercent (listingFieldsValid still applies)', async () => {
    const db = testEnv.authenticatedContext(ADMIN_UID, { role: 'admin' }).firestore()
    await assertFails(
      db.collection('listings').doc('new-listing').set(baseListing({ gstRatePercent: 40 })),
    )
  })

  it('denies deleting a listing outright', async () => {
    const db = testEnv.authenticatedContext(ADMIN_UID, { role: 'admin' }).firestore()
    await assertFails(db.collection('listings').doc('listing-active').delete())
  })
})

describe('listings/{listingId}/private/cost', () => {
  const now = 1_700_000_000_000

  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context
        .firestore()
        .collection('listings')
        .doc('listing-active')
        .collection('private')
        .doc('cost')
        .set({ costPricePaise: 30000, updatedAt: now })
    })
  })

  it('lets the owning seller read their own cost price', async () => {
    const db = testEnv.authenticatedContext(SELLER_A_UID, { role: 'seller', sellerId: SELLER_A_ID }).firestore()
    await assertSucceeds(db.collection('listings').doc('listing-active').collection('private').doc('cost').get())
  })

  it('lets the owning seller write their own cost price', async () => {
    const db = testEnv.authenticatedContext(SELLER_A_UID, { role: 'seller', sellerId: SELLER_A_ID }).firestore()
    await assertSucceeds(
      db
        .collection('listings')
        .doc('listing-active')
        .collection('private')
        .doc('cost')
        .set({ costPricePaise: 32000, updatedAt: now }),
    )
  })

  it("denies a different seller reading this listing's cost price", async () => {
    const db = testEnv.authenticatedContext(SELLER_B_UID, { role: 'seller', sellerId: SELLER_B_ID }).firestore()
    await assertFails(db.collection('listings').doc('listing-active').collection('private').doc('cost').get())
  })

  it('denies a signed-out client reading a cost price', async () => {
    const db = testEnv.unauthenticatedContext().firestore()
    await assertFails(db.collection('listings').doc('listing-active').collection('private').doc('cost').get())
  })

  it('lets an admin read any cost price', async () => {
    const db = testEnv.authenticatedContext(ADMIN_UID, { role: 'admin' }).firestore()
    await assertSucceeds(db.collection('listings').doc('listing-active').collection('private').doc('cost').get())
  })
})
