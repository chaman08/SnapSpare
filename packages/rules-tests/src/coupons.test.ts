import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { createTestEnv } from './testEnv.js'

const BUYER_UID = 'buyer-1'
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
    await db.collection('coupons').doc('active-coupon').set({
      code: 'SAVE10',
      status: 'active',
      discountType: 'percent',
      discountValue: 10,
      usedCount: 0,
      createdAt: now,
      updatedAt: now,
    })
    await db.collection('coupons').doc('expired-coupon').set({
      code: 'OLD5',
      status: 'expired',
      discountType: 'percent',
      discountValue: 5,
      usedCount: 12,
      createdAt: now,
      updatedAt: now,
    })
  })
})

describe('coupons/{couponId} read', () => {
  it('lets a signed-out client read an active coupon', async () => {
    const db = testEnv.unauthenticatedContext().firestore()
    await assertSucceeds(db.collection('coupons').doc('active-coupon').get())
  })

  it('lets a signed-in buyer read an active coupon', async () => {
    const db = testEnv.authenticatedContext(BUYER_UID).firestore()
    await assertSucceeds(db.collection('coupons').doc('active-coupon').get())
  })

  it('denies a signed-out client reading a non-active coupon', async () => {
    const db = testEnv.unauthenticatedContext().firestore()
    await assertFails(db.collection('coupons').doc('expired-coupon').get())
  })

  it('denies a signed-in buyer reading a non-active coupon', async () => {
    const db = testEnv.authenticatedContext(BUYER_UID).firestore()
    await assertFails(db.collection('coupons').doc('expired-coupon').get())
  })

  it('lets an admin read a non-active coupon', async () => {
    const db = testEnv.authenticatedContext(ADMIN_UID, { role: 'admin' }).firestore()
    await assertSucceeds(db.collection('coupons').doc('expired-coupon').get())
  })
})

describe('coupons/{couponId} write', () => {
  it('denies a signed-in buyer creating or updating a coupon', async () => {
    const db = testEnv.authenticatedContext(BUYER_UID).firestore()
    await assertFails(
      db.collection('coupons').doc('new-coupon').set({
        code: 'HACK50',
        status: 'active',
        discountType: 'percent',
        discountValue: 50,
        usedCount: 0,
        createdAt: now,
        updatedAt: now,
      }),
    )
    await assertFails(db.collection('coupons').doc('active-coupon').update({ discountValue: 99 }))
  })

  it('denies a signed-out write', async () => {
    const db = testEnv.unauthenticatedContext().firestore()
    await assertFails(db.collection('coupons').doc('active-coupon').update({ discountValue: 99 }))
  })

  it('lets an admin create and update coupons directly', async () => {
    const db = testEnv.authenticatedContext(ADMIN_UID, { role: 'admin' }).firestore()
    await assertSucceeds(
      db.collection('coupons').doc('new-coupon').set({
        code: 'ADMIN20',
        status: 'active',
        discountType: 'percent',
        discountValue: 20,
        usedCount: 0,
        createdAt: now,
        updatedAt: now,
      }),
    )
    await assertSucceeds(db.collection('coupons').doc('active-coupon').update({ status: 'expired' }))
  })
})
