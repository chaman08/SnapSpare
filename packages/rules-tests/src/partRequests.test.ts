import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { createTestEnv } from './testEnv.js'

const SELLER_A_UID = 'seller-a-owner'
const SELLER_A_ID = 'seller-a'
const SELLER_B_UID = 'seller-b-owner'
const SELLER_B_ID = 'seller-b'
const ADMIN_UID = 'admin-1'

const now = 1_700_000_000_000

function baseRequest(overrides: Record<string, unknown> = {}) {
  return {
    sellerId: SELLER_A_ID,
    title: 'Rear Brake Drum',
    partType: 'aftermarket',
    categorySlug: 'brake',
    images: [],
    attributes: {},
    status: 'pending',
    reviewNotes: [],
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
    await context.firestore().collection('partRequests').doc('request-a').set(baseRequest())
  })
})

describe('partRequests/{requestId} read', () => {
  it('lets the owning seller read their own request', async () => {
    const db = testEnv.authenticatedContext(SELLER_A_UID, { role: 'seller', sellerId: SELLER_A_ID }).firestore()
    await assertSucceeds(db.collection('partRequests').doc('request-a').get())
  })

  it("denies a different seller reading another seller's request", async () => {
    const db = testEnv.authenticatedContext(SELLER_B_UID, { role: 'seller', sellerId: SELLER_B_ID }).firestore()
    await assertFails(db.collection('partRequests').doc('request-a').get())
  })

  it('denies a signed-out read', async () => {
    const db = testEnv.unauthenticatedContext().firestore()
    await assertFails(db.collection('partRequests').doc('request-a').get())
  })

  it('lets an admin read any request', async () => {
    const db = testEnv.authenticatedContext(ADMIN_UID, { role: 'admin' }).firestore()
    await assertSucceeds(db.collection('partRequests').doc('request-a').get())
  })
})

describe('partRequests/{requestId} write — callable-only', () => {
  it('denies a direct client create, even by the owning seller', async () => {
    const db = testEnv.authenticatedContext(SELLER_A_UID, { role: 'seller', sellerId: SELLER_A_ID }).firestore()
    await assertFails(db.collection('partRequests').doc('request-b').set(baseRequest()))
  })

  it('denies a direct client update by an admin — reviewPartRequest is the only writer', async () => {
    const db = testEnv.authenticatedContext(ADMIN_UID, { role: 'admin' }).firestore()
    await assertFails(db.collection('partRequests').doc('request-a').update({ status: 'approved' }))
  })
})
