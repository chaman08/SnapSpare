import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { createTestEnv } from './testEnv.js'

const BUYER_UID = 'buyer-1'
const OTHER_BUYER_UID = 'buyer-2'
const ADMIN_UID = 'admin-1'

const now = 1_700_000_000_000

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
    // Doc id == the owning buyer's uid (one cart per buyer).
    await context.firestore().collection('carts').doc(BUYER_UID).set({
      items: [
        { listingId: 'listing-1', qty: 2, unitPricePaise: 15000, tierMinQtyApplied: 1, savedForLater: false },
      ],
      updatedAt: now,
    })
  })
})

describe('carts/{userId} read', () => {
  it('lets the owning buyer read their own cart', async () => {
    const db = testEnv.authenticatedContext(BUYER_UID).firestore()
    await assertSucceeds(db.collection('carts').doc(BUYER_UID).get())
  })

  it("denies another buyer reading someone else's cart", async () => {
    const db = testEnv.authenticatedContext(OTHER_BUYER_UID).firestore()
    await assertFails(db.collection('carts').doc(BUYER_UID).get())
  })

  it('denies a signed-out read', async () => {
    const db = testEnv.unauthenticatedContext().firestore()
    await assertFails(db.collection('carts').doc(BUYER_UID).get())
  })

  it('denies an admin reading a cart they do not own (no admin bypass on this rule)', async () => {
    const db = testEnv.authenticatedContext(ADMIN_UID, { role: 'admin' }).firestore()
    await assertFails(db.collection('carts').doc(BUYER_UID).get())
  })
})

describe('carts/{userId} write', () => {
  it('lets the owning buyer create/update their own cart', async () => {
    const db = testEnv.authenticatedContext(BUYER_UID).firestore()
    await assertSucceeds(
      db.collection('carts').doc(BUYER_UID).set({
        items: [{ listingId: 'listing-2', qty: 1, unitPricePaise: 20000, tierMinQtyApplied: 1, savedForLater: false }],
        updatedAt: now,
      }),
    )
  })

  it("denies another buyer writing to someone else's cart", async () => {
    const db = testEnv.authenticatedContext(OTHER_BUYER_UID).firestore()
    await assertFails(db.collection('carts').doc(BUYER_UID).update({ items: [] }))
  })

  it('denies a signed-out write', async () => {
    const db = testEnv.unauthenticatedContext().firestore()
    await assertFails(db.collection('carts').doc(BUYER_UID).set({ items: [], updatedAt: now }))
  })

  it('denies an admin writing to a cart they do not own', async () => {
    const db = testEnv.authenticatedContext(ADMIN_UID, { role: 'admin' }).firestore()
    await assertFails(db.collection('carts').doc(BUYER_UID).update({ items: [] }))
  })
})
