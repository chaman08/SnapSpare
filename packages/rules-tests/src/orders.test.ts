import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { createTestEnv } from './testEnv.js'

const BUYER_UID = 'buyer-1'
const OTHER_BUYER_UID = 'buyer-2'
const SELLER_UID = 'seller-1-owner'
const SELLER_ID = 'seller-1'
const OTHER_SELLER_UID = 'seller-2-owner'
const OTHER_SELLER_ID = 'seller-2'
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
    await db.collection('orders').doc('order-1').set({
      buyerId: BUYER_UID,
      status: 'placed',
      subOrderIds: ['suborder-1'],
      totalPaise: 100000,
      createdAt: now,
      updatedAt: now,
    })
    await db.collection('subOrders').doc('suborder-1').set({
      orderId: 'order-1',
      buyerId: BUYER_UID,
      sellerId: SELLER_ID,
      status: 'pending',
      totalPaise: 100000,
      createdAt: now,
      updatedAt: now,
    })
    await db.collection('payouts').doc('payout-1').set({ sellerId: SELLER_ID, status: 'pending', netAmountPaise: 5000 })
    await db.collection('ledgers').doc('ledger-1').set({ ownerType: 'seller', ownerId: SELLER_ID, currentBalancePaise: 1000 })
    await db.collection('ledgers').doc('ledger-1').collection('entries').doc('entry-1').set({
      ledgerId: 'ledger-1',
      type: 'order_credit',
      direction: 'credit',
      amountPaise: 1000,
      balanceAfterPaise: 1000,
      createdAt: now,
    })
    await db.collection('creditAccounts').doc('credit-1').set({
      buyerId: BUYER_UID,
      creditLimitPaise: 500000,
      availableCreditPaise: 500000,
      outstandingPaise: 0,
      status: 'active',
    })
  })
})

describe('orders/{orderId}', () => {
  it('lets the buyer read their own order', async () => {
    const db = testEnv.authenticatedContext(BUYER_UID).firestore()
    await assertSucceeds(db.collection('orders').doc('order-1').get())
  })

  it("denies another buyer reading someone else's order", async () => {
    const db = testEnv.authenticatedContext(OTHER_BUYER_UID).firestore()
    await assertFails(db.collection('orders').doc('order-1').get())
  })

  it('lets an admin read any order', async () => {
    const db = testEnv.authenticatedContext(ADMIN_UID, { role: 'admin' }).firestore()
    await assertSucceeds(db.collection('orders').doc('order-1').get())
  })

  it('denies the buyer writing to their own order at all', async () => {
    const db = testEnv.authenticatedContext(BUYER_UID).firestore()
    await assertFails(db.collection('orders').doc('order-1').update({ status: 'cancelled' }))
    await assertFails(
      db.collection('orders').doc('order-2').set({ buyerId: BUYER_UID, status: 'placed', subOrderIds: ['x'] }),
    )
  })

  it('denies an admin writing directly to an order (Cloud Functions only)', async () => {
    const db = testEnv.authenticatedContext(ADMIN_UID, { role: 'admin' }).firestore()
    await assertFails(db.collection('orders').doc('order-1').update({ status: 'cancelled' }))
  })
})

describe('subOrders/{subOrderId}', () => {
  it('lets the buyer read their own subOrder', async () => {
    const db = testEnv.authenticatedContext(BUYER_UID).firestore()
    await assertSucceeds(db.collection('subOrders').doc('suborder-1').get())
  })

  it('lets the owning seller read their subOrder', async () => {
    const db = testEnv.authenticatedContext(SELLER_UID, { role: 'seller', sellerId: SELLER_ID }).firestore()
    await assertSucceeds(db.collection('subOrders').doc('suborder-1').get())
  })

  it("denies a different seller reading someone else's subOrder", async () => {
    const db = testEnv
      .authenticatedContext(OTHER_SELLER_UID, { role: 'seller', sellerId: OTHER_SELLER_ID })
      .firestore()
    await assertFails(db.collection('subOrders').doc('suborder-1').get())
  })

  it('denies the seller writing to the subOrder directly', async () => {
    const db = testEnv.authenticatedContext(SELLER_UID, { role: 'seller', sellerId: SELLER_ID }).firestore()
    await assertFails(db.collection('subOrders').doc('suborder-1').update({ status: 'shipped' }))
  })
})

describe('payouts / ledgers / creditAccounts — money collections', () => {
  it('lets the owning seller read their payout, denies another seller', async () => {
    const ownDb = testEnv.authenticatedContext(SELLER_UID, { role: 'seller', sellerId: SELLER_ID }).firestore()
    await assertSucceeds(ownDb.collection('payouts').doc('payout-1').get())

    const otherDb = testEnv
      .authenticatedContext(OTHER_SELLER_UID, { role: 'seller', sellerId: OTHER_SELLER_ID })
      .firestore()
    await assertFails(otherDb.collection('payouts').doc('payout-1').get())
  })

  it('denies any client write to payouts', async () => {
    const db = testEnv.authenticatedContext(ADMIN_UID, { role: 'admin' }).firestore()
    await assertFails(db.collection('payouts').doc('payout-1').update({ status: 'paid' }))
  })

  it('lets the owning seller read their ledger and its entries', async () => {
    const db = testEnv.authenticatedContext(SELLER_UID, { role: 'seller', sellerId: SELLER_ID }).firestore()
    await assertSucceeds(db.collection('ledgers').doc('ledger-1').get())
    await assertSucceeds(db.collection('ledgers').doc('ledger-1').collection('entries').doc('entry-1').get())
  })

  it("denies another seller reading someone else's ledger or entries", async () => {
    const db = testEnv
      .authenticatedContext(OTHER_SELLER_UID, { role: 'seller', sellerId: OTHER_SELLER_ID })
      .firestore()
    await assertFails(db.collection('ledgers').doc('ledger-1').get())
    await assertFails(db.collection('ledgers').doc('ledger-1').collection('entries').doc('entry-1').get())
  })

  it('lets the owning buyer read their credit account, denies another buyer', async () => {
    const ownDb = testEnv.authenticatedContext(BUYER_UID).firestore()
    await assertSucceeds(ownDb.collection('creditAccounts').doc('credit-1').get())

    const otherDb = testEnv.authenticatedContext(OTHER_BUYER_UID).firestore()
    await assertFails(otherDb.collection('creditAccounts').doc('credit-1').get())
  })

  it('denies any client write to creditAccounts', async () => {
    const db = testEnv.authenticatedContext(BUYER_UID).firestore()
    await assertFails(db.collection('creditAccounts').doc('credit-1').update({ outstandingPaise: 999 }))
  })
})
