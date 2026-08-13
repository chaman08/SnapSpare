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
    await db.collection('webhookEvents').doc('evt-1').set({
      gateway: 'razorpay',
      eventType: 'payment.captured',
      payload: {},
      signatureValid: true,
      status: 'processed',
      receivedAt: now,
    })
    await db.collection('refundBankDetails').doc('rbd-1').set({
      buyerId: BUYER_UID,
      returnId: 'return-1',
      accountHolderName: 'Test Buyer',
      accountNumber: '1234567890',
      ifsc: 'HDFC0000123',
      bankName: 'HDFC Bank',
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    })
    await db.collection('payouts').doc('payout-1').set({
      sellerId: SELLER_ID,
      periodFrom: now,
      periodTo: now,
      grossAmountPaise: 10000,
      commissionPaise: 500,
      tcsPaise: 100,
      tdsPaise: 100,
      adjustmentsPaise: 0,
      netAmountPaise: 9300,
      status: 'paid',
      subOrderIds: [],
      createdAt: now,
      updatedAt: now,
    })
    await db.collection('creditLimitRequests').doc('req-1').set({
      buyerId: BUYER_UID,
      requestedLimitPaise: 5000000,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    })
    await db.collection('creditStatements').doc('stmt-1').set({
      creditAccountId: 'credit-1',
      buyerId: BUYER_UID,
      periodFrom: now,
      periodTo: now,
      openingBalancePaise: 100000,
      closingBalancePaise: 100000,
      amountDuePaise: 100000,
      dueDate: now,
      status: 'due',
      createdAt: now,
      updatedAt: now,
    })
    await db.collection('creditAccounts').doc('credit-1').set({
      buyerId: BUYER_UID,
      creditLimitPaise: 5000000,
      availableCreditPaise: 4900000,
      outstandingPaise: 100000,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    })
    await db.collection('creditAccounts').doc('credit-1').collection('limitChanges').doc('change-1').set({
      creditAccountId: 'credit-1',
      changedBy: ADMIN_UID,
      previousLimitPaise: 0,
      newLimitPaise: 5000000,
      createdAt: now,
    })
  })
})

describe('webhookEvents/{eventId}', () => {
  it('denies any client read or write, including admin', async () => {
    const buyerDb = testEnv.authenticatedContext(BUYER_UID).firestore()
    await assertFails(buyerDb.collection('webhookEvents').doc('evt-1').get())

    const adminDb = testEnv.authenticatedContext(ADMIN_UID, { role: 'admin' }).firestore()
    await assertFails(adminDb.collection('webhookEvents').doc('evt-1').get())
  })
})

describe('refundBankDetails/{refundBankDetailId}', () => {
  it('lets the owning buyer read their submission', async () => {
    const db = testEnv.authenticatedContext(BUYER_UID).firestore()
    await assertSucceeds(db.collection('refundBankDetails').doc('rbd-1').get())
  })

  it("denies another buyer reading someone else's bank details", async () => {
    const db = testEnv.authenticatedContext(OTHER_BUYER_UID).firestore()
    await assertFails(db.collection('refundBankDetails').doc('rbd-1').get())
  })

  it('lets an admin read any submission', async () => {
    const db = testEnv.authenticatedContext(ADMIN_UID, { role: 'admin' }).firestore()
    await assertSucceeds(db.collection('refundBankDetails').doc('rbd-1').get())
  })

  it('denies any client write (submitRefundBankDetails callable only)', async () => {
    const db = testEnv.authenticatedContext(BUYER_UID).firestore()
    await assertFails(
      db.collection('refundBankDetails').doc('rbd-2').set({
        buyerId: BUYER_UID,
        returnId: 'return-2',
        accountHolderName: 'x',
        accountNumber: '1',
        ifsc: 'HDFC0000123',
        bankName: 'x',
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      }),
    )
  })
})

describe('payouts/{payoutId}', () => {
  it('lets the owning seller read their payout', async () => {
    const db = testEnv.authenticatedContext(SELLER_UID, { role: 'seller', sellerId: SELLER_ID }).firestore()
    await assertSucceeds(db.collection('payouts').doc('payout-1').get())
  })

  it("denies another seller reading someone else's payout", async () => {
    const db = testEnv.authenticatedContext(OTHER_SELLER_UID, { role: 'seller', sellerId: OTHER_SELLER_ID }).firestore()
    await assertFails(db.collection('payouts').doc('payout-1').get())
  })

  it('denies any client write', async () => {
    const db = testEnv.authenticatedContext(SELLER_UID, { role: 'seller', sellerId: SELLER_ID }).firestore()
    await assertFails(db.collection('payouts').doc('payout-1').update({ status: 'failed' }))
  })
})

describe('creditLimitRequests/{requestId}', () => {
  it('lets the owning buyer read their request', async () => {
    const db = testEnv.authenticatedContext(BUYER_UID).firestore()
    await assertSucceeds(db.collection('creditLimitRequests').doc('req-1').get())
  })

  it("denies another buyer reading someone else's request", async () => {
    const db = testEnv.authenticatedContext(OTHER_BUYER_UID).firestore()
    await assertFails(db.collection('creditLimitRequests').doc('req-1').get())
  })

  it('denies any client write (requestCreditLimit/approveCreditLimit callables only)', async () => {
    const db = testEnv.authenticatedContext(BUYER_UID).firestore()
    await assertFails(db.collection('creditLimitRequests').doc('req-1').update({ status: 'approved' }))
  })
})

describe('creditStatements/{statementId}', () => {
  it('lets the owning buyer read their statement', async () => {
    const db = testEnv.authenticatedContext(BUYER_UID).firestore()
    await assertSucceeds(db.collection('creditStatements').doc('stmt-1').get())
  })

  it("denies another buyer reading someone else's statement", async () => {
    const db = testEnv.authenticatedContext(OTHER_BUYER_UID).firestore()
    await assertFails(db.collection('creditStatements').doc('stmt-1').get())
  })
})

describe('creditAccounts/{creditAccountId}/limitChanges/{changeId}', () => {
  it('lets the owning buyer read their credit account limit-change log', async () => {
    const db = testEnv.authenticatedContext(BUYER_UID).firestore()
    await assertSucceeds(db.collection('creditAccounts').doc('credit-1').collection('limitChanges').doc('change-1').get())
  })

  it("denies another buyer reading someone else's limit-change log", async () => {
    const db = testEnv.authenticatedContext(OTHER_BUYER_UID).firestore()
    await assertFails(db.collection('creditAccounts').doc('credit-1').collection('limitChanges').doc('change-1').get())
  })

  it('lets an admin read any limit-change log', async () => {
    const db = testEnv.authenticatedContext(ADMIN_UID, { role: 'admin' }).firestore()
    await assertSucceeds(db.collection('creditAccounts').doc('credit-1').collection('limitChanges').doc('change-1').get())
  })

  it('denies any client write', async () => {
    const db = testEnv.authenticatedContext(BUYER_UID).firestore()
    await assertFails(
      db.collection('creditAccounts').doc('credit-1').collection('limitChanges').doc('change-2').set({
        creditAccountId: 'credit-1',
        changedBy: BUYER_UID,
        previousLimitPaise: 0,
        newLimitPaise: 99999999,
        createdAt: now,
      }),
    )
  })
})
