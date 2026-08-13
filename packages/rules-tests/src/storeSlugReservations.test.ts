import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { createTestEnv } from './testEnv.js'

const SELLER_A_UID = 'seller-a-owner'
const SELLER_A_ID = 'seller-a'

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
    await context.firestore().collection('storeSlugReservations').doc('aurangabad-auto').set({
      sellerId: SELLER_A_ID,
      claimedAt: Date.now(),
    })
  })
})

describe('storeSlugReservations/{slug} read', () => {
  it('lets a signed-out buyer resolve a claimed slug (Phase 14 M9: public store page routing)', async () => {
    const db = testEnv.unauthenticatedContext().firestore()
    await assertSucceeds(db.collection('storeSlugReservations').doc('aurangabad-auto').get())
  })
})

describe('storeSlugReservations/{slug} write — callable-only', () => {
  it('denies a direct client claim, even by the seller it would belong to', async () => {
    const db = testEnv.authenticatedContext(SELLER_A_UID, { role: 'seller', sellerId: SELLER_A_ID }).firestore()
    await assertFails(
      db.collection('storeSlugReservations').doc('grabbed-by-client').set({
        sellerId: SELLER_A_ID,
        claimedAt: Date.now(),
      }),
    )
  })

  it('denies a direct client overwrite of an existing reservation', async () => {
    const db = testEnv.authenticatedContext(SELLER_A_UID, { role: 'seller', sellerId: SELLER_A_ID }).firestore()
    await assertFails(db.collection('storeSlugReservations').doc('aurangabad-auto').update({ sellerId: 'seller-b' }))
  })
})
