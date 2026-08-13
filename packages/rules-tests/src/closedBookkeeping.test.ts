// Internal-bookkeeping collections that are fully closed to every client —
// `allow read, write: if false` in firestore.rules, no admin bypass. Each is
// written and read exclusively by a Cloud Function via the Admin SDK, which
// bypasses these rules entirely:
//   - idempotencyKeys      createOrder/confirmPayment retry bookkeeping
//   - creditRepayments     internal audit record of a Khata repayment
//   - shippingRateCache    getShippingRates.ts's short-lived rate cache
//   - rateLimits           lookupVehicleByReg's daily-cap counters
//   - deviceFingerprints   Phase 23 duplicate-account abuse detection
import { assertFails, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { createTestEnv } from './testEnv.js'

const BUYER_UID = 'buyer-1'
const SELLER_UID = 'seller-1-owner'
const SELLER_ID = 'seller-1'
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
    const db = context.firestore()
    await db.collection('idempotencyKeys').doc('key-1').set({ scope: 'createOrder', createdAt: now })
    await db.collection('creditRepayments').doc('repayment-1').set({
      creditAccountId: 'credit-1',
      buyerId: BUYER_UID,
      amountPaise: 50000,
      createdAt: now,
    })
    await db.collection('shippingRateCache').doc('110001_400001_slab1').set({
      originPincode: '110001',
      destPincode: '400001',
      weightSlab: 1,
      ratePaise: 4000,
      expiresAt: now + 3_600_000,
    })
    await db.collection('rateLimits').doc(`${BUYER_UID}_lookupVehicleByReg`).set({
      uid: BUYER_UID,
      action: 'lookupVehicleByReg',
      count: 3,
      windowStart: now,
    })
    await db.collection('deviceFingerprints').doc('fp-1').set({
      fingerprint: 'abc123',
      userIds: [BUYER_UID],
      createdAt: now,
    })
  })
})

describe.each([
  ['idempotencyKeys', 'key-1'],
  ['creditRepayments', 'repayment-1'],
  ['shippingRateCache', '110001_400001_slab1'],
  ['rateLimits', `${BUYER_UID}_lookupVehicleByReg`],
  ['deviceFingerprints', 'fp-1'],
])('%s/{docId} — fully closed, no admin bypass', (collection, docId) => {
  it('denies read for a signed-out client', async () => {
    const db = testEnv.unauthenticatedContext().firestore()
    await assertFails(db.collection(collection).doc(docId).get())
  })

  it('denies read for a signed-in buyer, seller and admin', async () => {
    await assertFails(testEnv.authenticatedContext(BUYER_UID).firestore().collection(collection).doc(docId).get())
    await assertFails(
      testEnv.authenticatedContext(SELLER_UID, { role: 'seller', sellerId: SELLER_ID }).firestore().collection(collection).doc(docId).get(),
    )
    await assertFails(testEnv.authenticatedContext(ADMIN_UID, { role: 'admin' }).firestore().collection(collection).doc(docId).get())
  })

  it('denies a signed-out write', async () => {
    const db = testEnv.unauthenticatedContext().firestore()
    await assertFails(db.collection(collection).doc(docId).set({ x: 1 }))
  })

  it('denies a write, including by an admin', async () => {
    await assertFails(
      testEnv.authenticatedContext(BUYER_UID).firestore().collection(collection).doc(docId).update({ x: 1 }),
    )
    await assertFails(
      testEnv.authenticatedContext(ADMIN_UID, { role: 'admin' }).firestore().collection(collection).doc(docId).update({ x: 1 }),
    )
  })
})
