import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { createTestEnv } from './testEnv.js'

const SELLER_A_UID = 'seller-a-owner'
const SELLER_A_ID = 'seller-a'
const SELLER_B_UID = 'seller-b-owner'
const SELLER_B_ID = 'seller-b'
const ADMIN_UID = 'admin-1'

const now = 1_700_000_000_000

function baseTemplate(overrides: Record<string, unknown> = {}) {
  return {
    sellerId: SELLER_A_ID,
    name: 'Standard 3-step',
    pricing: { moq: 1, stepQty: 1, tiers: [{ minQty: 1, maxQty: null, unitPricePaise: 1000 }] },
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
    await context.firestore().collection('pricingTemplates').doc('template-a').set(baseTemplate())
  })
})

describe('pricingTemplates/{templateId} read', () => {
  it('lets the owning seller read their own template', async () => {
    const db = testEnv.authenticatedContext(SELLER_A_UID, { role: 'seller', sellerId: SELLER_A_ID }).firestore()
    await assertSucceeds(db.collection('pricingTemplates').doc('template-a').get())
  })

  it("denies a different seller reading another seller's template", async () => {
    const db = testEnv.authenticatedContext(SELLER_B_UID, { role: 'seller', sellerId: SELLER_B_ID }).firestore()
    await assertFails(db.collection('pricingTemplates').doc('template-a').get())
  })

  it('denies a signed-out read', async () => {
    const db = testEnv.unauthenticatedContext().firestore()
    await assertFails(db.collection('pricingTemplates').doc('template-a').get())
  })

  it('lets an admin read any template', async () => {
    const db = testEnv.authenticatedContext(ADMIN_UID, { role: 'admin' }).firestore()
    await assertSucceeds(db.collection('pricingTemplates').doc('template-a').get())
  })
})

describe('pricingTemplates/{templateId} write — callable-only', () => {
  it('denies a direct client create, even by the owning seller', async () => {
    const db = testEnv.authenticatedContext(SELLER_A_UID, { role: 'seller', sellerId: SELLER_A_ID }).firestore()
    await assertFails(db.collection('pricingTemplates').doc('template-b').set(baseTemplate()))
  })

  it('denies a direct client update, even by the owning seller', async () => {
    const db = testEnv.authenticatedContext(SELLER_A_UID, { role: 'seller', sellerId: SELLER_A_ID }).firestore()
    await assertFails(db.collection('pricingTemplates').doc('template-a').update({ name: 'Renamed' }))
  })

  it('denies a direct client write by an admin too — savePricingTemplate is the only writer', async () => {
    const db = testEnv.authenticatedContext(ADMIN_UID, { role: 'admin' }).firestore()
    await assertFails(db.collection('pricingTemplates').doc('template-a').update({ name: 'Renamed' }))
  })
})
