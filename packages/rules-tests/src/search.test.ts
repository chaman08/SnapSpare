import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { createTestEnv } from './testEnv.js'

const BUYER_UID = 'buyer-1'
const OTHER_BUYER_UID = 'buyer-2'
const ADMIN_UID = 'admin-1'

const now = Date.now()

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
    await context.firestore().collection('searchMisses').doc('miss-1').set({
      query: 'brake shoe',
      normalizedQuery: 'brake shoe',
      activeFilters: {},
      createdAt: now,
    })
    await context.firestore().collection('searchIndexQueue').doc('listing-1').set({
      listingId: 'listing-1',
      dueAt: now,
    })
  })
})

describe('searchMisses', () => {
  it('lets a signed-out visitor log a zero-result query', async () => {
    const db = testEnv.unauthenticatedContext().firestore()
    await assertSucceeds(
      db.collection('searchMisses').add({
        query: 'turbo kit',
        normalizedQuery: 'turbo kit',
        activeFilters: {},
        createdAt: now,
      }),
    )
  })

  it('lets a signed-in buyer log a zero-result query tagged with their own uid', async () => {
    const db = testEnv.authenticatedContext(BUYER_UID).firestore()
    await assertSucceeds(
      db.collection('searchMisses').add({
        query: 'turbo kit',
        normalizedQuery: 'turbo kit',
        activeFilters: {},
        userId: BUYER_UID,
        createdAt: now,
      }),
    )
  })

  it("denies tagging a search miss with another buyer's uid", async () => {
    const db = testEnv.authenticatedContext(BUYER_UID).firestore()
    await assertFails(
      db.collection('searchMisses').add({
        query: 'turbo kit',
        normalizedQuery: 'turbo kit',
        activeFilters: {},
        userId: OTHER_BUYER_UID,
        createdAt: now,
      }),
    )
  })

  it('denies a create missing required fields', async () => {
    const db = testEnv.unauthenticatedContext().firestore()
    await assertFails(db.collection('searchMisses').add({ query: 'turbo kit', createdAt: now }))
  })

  it('denies reading or updating an existing search miss for anyone but an admin', async () => {
    const buyerDb = testEnv.authenticatedContext(BUYER_UID).firestore()
    await assertFails(buyerDb.collection('searchMisses').doc('miss-1').get())
    await assertFails(buyerDb.collection('searchMisses').doc('miss-1').update({ query: 'edited' }))

    const adminDb = testEnv.authenticatedContext(ADMIN_UID, { role: 'admin' }).firestore()
    await assertSucceeds(adminDb.collection('searchMisses').doc('miss-1').get())
  })
})

describe('searchIndexQueue', () => {
  it('denies any client read or write — Cloud-Function/Admin-SDK only', async () => {
    const buyerDb = testEnv.authenticatedContext(BUYER_UID).firestore()
    await assertFails(buyerDb.collection('searchIndexQueue').doc('listing-1').get())
    await assertFails(buyerDb.collection('searchIndexQueue').doc('listing-2').set({ listingId: 'listing-2', dueAt: now }))

    const adminDb = testEnv.authenticatedContext(ADMIN_UID, { role: 'admin' }).firestore()
    await assertFails(adminDb.collection('searchIndexQueue').doc('listing-1').get())
  })
})
