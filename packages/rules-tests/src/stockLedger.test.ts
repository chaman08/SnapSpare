import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { createTestEnv } from './testEnv.js'

const SELLER_A_UID = 'seller-a-owner'
const SELLER_A_ID = 'seller-a'
const SELLER_B_UID = 'seller-b-owner'
const SELLER_B_ID = 'seller-b'
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
    await context.firestore().collection('stockLedger').doc('entry-a').set({
      listingId: 'listing-a',
      sellerId: SELLER_A_ID,
      deltaQty: 10,
      reason: 'restock',
      balanceAfter: 60,
      createdAt: now,
    })
  })
})

describe('stockLedger/{entryId} read', () => {
  it('lets the owning seller read their own ledger entry', async () => {
    const db = testEnv.authenticatedContext(SELLER_A_UID, { role: 'seller', sellerId: SELLER_A_ID }).firestore()
    await assertSucceeds(db.collection('stockLedger').doc('entry-a').get())
  })

  it("denies a different seller reading another seller's ledger entry", async () => {
    const db = testEnv.authenticatedContext(SELLER_B_UID, { role: 'seller', sellerId: SELLER_B_ID }).firestore()
    await assertFails(db.collection('stockLedger').doc('entry-a').get())
  })

  it('denies a signed-out read', async () => {
    const db = testEnv.unauthenticatedContext().firestore()
    await assertFails(db.collection('stockLedger').doc('entry-a').get())
  })

  it('lets an admin read any ledger entry', async () => {
    const db = testEnv.authenticatedContext(ADMIN_UID, { role: 'admin' }).firestore()
    await assertSucceeds(db.collection('stockLedger').doc('entry-a').get())
  })
})

describe('stockLedger/{entryId} write — callable/transaction-only', () => {
  it('denies a direct client create, even by the owning seller', async () => {
    const db = testEnv.authenticatedContext(SELLER_A_UID, { role: 'seller', sellerId: SELLER_A_ID }).firestore()
    await assertFails(
      db.collection('stockLedger').doc('entry-b').set({
        listingId: 'listing-a',
        sellerId: SELLER_A_ID,
        deltaQty: 5,
        reason: 'adjustment',
        createdAt: now,
      }),
    )
  })

  it('denies a direct client write by an admin too — adjustStock/order transactions are the only writers', async () => {
    const db = testEnv.authenticatedContext(ADMIN_UID, { role: 'admin' }).firestore()
    await assertFails(db.collection('stockLedger').doc('entry-a').update({ note: 'edited' }))
  })
})
