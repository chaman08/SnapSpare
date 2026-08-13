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
    await context.firestore().collection('sellerDailyStats').doc('stat-a').set({
      sellerId: SELLER_A_ID,
      date: '2026-08-06',
      ordersCount: 3,
      revenuePaise: 330000,
      unitsSold: 4,
      topParts: [],
      slaAcceptedOnTime: 2,
      slaAcceptedLate: 1,
      slaPackedOnTime: 3,
      slaPackedLate: 0,
      createdAt: now,
      updatedAt: now,
    })
  })
})

describe('sellerDailyStats/{statId} read', () => {
  it('lets the owning seller read their own daily stat', async () => {
    const db = testEnv.authenticatedContext(SELLER_A_UID, { role: 'seller', sellerId: SELLER_A_ID }).firestore()
    await assertSucceeds(db.collection('sellerDailyStats').doc('stat-a').get())
  })

  it('lets a seller staff member (any permission, or none) read their seller\'s daily stat', async () => {
    const db = testEnv
      .authenticatedContext(SELLER_A_UID, { role: 'seller', sellerId: SELLER_A_ID, staffRole: 'packer', permissions: ['manage_orders'] })
      .firestore()
    await assertSucceeds(db.collection('sellerDailyStats').doc('stat-a').get())
  })

  it("denies a different seller reading another seller's daily stat", async () => {
    const db = testEnv.authenticatedContext(SELLER_B_UID, { role: 'seller', sellerId: SELLER_B_ID }).firestore()
    await assertFails(db.collection('sellerDailyStats').doc('stat-a').get())
  })

  it('denies a signed-out read', async () => {
    const db = testEnv.unauthenticatedContext().firestore()
    await assertFails(db.collection('sellerDailyStats').doc('stat-a').get())
  })

  it('lets an admin read any daily stat', async () => {
    const db = testEnv.authenticatedContext(ADMIN_UID, { role: 'admin' }).firestore()
    await assertSucceeds(db.collection('sellerDailyStats').doc('stat-a').get())
  })
})

describe('sellerDailyStats/{statId} write — callable-only', () => {
  it('denies a direct client create, even by the owning seller', async () => {
    const db = testEnv.authenticatedContext(SELLER_A_UID, { role: 'seller', sellerId: SELLER_A_ID }).firestore()
    await assertFails(
      db.collection('sellerDailyStats').doc('stat-b').set({
        sellerId: SELLER_A_ID,
        date: '2026-08-07',
        ordersCount: 0,
        revenuePaise: 0,
        unitsSold: 0,
        topParts: [],
        slaAcceptedOnTime: 0,
        slaAcceptedLate: 0,
        slaPackedOnTime: 0,
        slaPackedLate: 0,
        createdAt: now,
        updatedAt: now,
      }),
    )
  })

  it('denies a direct client write by an admin too — rollupSellerDailyStats.ts is the only writer', async () => {
    const db = testEnv.authenticatedContext(ADMIN_UID, { role: 'admin' }).firestore()
    await assertFails(db.collection('sellerDailyStats').doc('stat-a').update({ ordersCount: 99 }))
  })
})
