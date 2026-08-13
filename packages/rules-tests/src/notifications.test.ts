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
    await db.collection('notificationsQueue').doc('notif-1').set({
      userId: BUYER_UID,
      type: 'suborder_accepted',
      title: 'Order accepted',
      body: 'The seller has accepted your order.',
      data: {},
      channels: ['push'],
      status: 'queued',
      createdAt: now,
    })
    await db.collection('slaBreaches').doc('breach-1').set({
      sellerId: SELLER_ID,
      orderId: 'order-1',
      subOrderId: 'suborder-1',
      acceptByAt: now,
      breachedAt: now,
      createdAt: now,
    })
    await db.collection('notificationPreferences').doc(BUYER_UID).set({
      userId: BUYER_UID,
      channels: { push: true, sms: true, whatsapp: true, email: true },
      marketingOptOut: false,
      updatedAt: now,
    })
    await db.collection('notificationsDeadLetter').doc('dl-1').set({
      notificationId: 'notif-1',
      userId: BUYER_UID,
      channel: 'whatsapp',
      type: 'suborder_accepted',
      attempts: 5,
      lastError: 'provider timeout',
      failedAt: now,
      resolved: false,
    })
    await db.collection('notificationRateCounters').doc('counter-1').set({
      userId: BUYER_UID,
      channel: 'push',
      date: '2026-08-09',
      count: 1,
    })
  })
})

describe('notificationsQueue/{notificationId}', () => {
  it('lets the owning user read their notification', async () => {
    const db = testEnv.authenticatedContext(BUYER_UID).firestore()
    await assertSucceeds(db.collection('notificationsQueue').doc('notif-1').get())
  })

  it("denies another user reading someone else's notification", async () => {
    const db = testEnv.authenticatedContext(OTHER_BUYER_UID).firestore()
    await assertFails(db.collection('notificationsQueue').doc('notif-1').get())
  })

  it('lets an admin read any notification', async () => {
    const db = testEnv.authenticatedContext(ADMIN_UID, { role: 'admin' }).firestore()
    await assertSucceeds(db.collection('notificationsQueue').doc('notif-1').get())
  })

  it('denies any client write, including the owner and admin (Cloud Functions only)', async () => {
    const ownerDb = testEnv.authenticatedContext(BUYER_UID).firestore()
    await assertFails(ownerDb.collection('notificationsQueue').doc('notif-1').update({ status: 'sent' }))

    const adminDb = testEnv.authenticatedContext(ADMIN_UID, { role: 'admin' }).firestore()
    await assertFails(adminDb.collection('notificationsQueue').doc('notif-1').update({ status: 'sent' }))
  })
})

describe('slaBreaches/{slaBreachId}', () => {
  it('lets the owning seller read their SLA breach record', async () => {
    const db = testEnv.authenticatedContext(SELLER_UID, { role: 'seller', sellerId: SELLER_ID }).firestore()
    await assertSucceeds(db.collection('slaBreaches').doc('breach-1').get())
  })

  it("denies another seller reading someone else's SLA breach record", async () => {
    const db = testEnv
      .authenticatedContext(OTHER_SELLER_UID, { role: 'seller', sellerId: OTHER_SELLER_ID })
      .firestore()
    await assertFails(db.collection('slaBreaches').doc('breach-1').get())
  })

  it('lets an admin read any SLA breach record', async () => {
    const db = testEnv.authenticatedContext(ADMIN_UID, { role: 'admin' }).firestore()
    await assertSucceeds(db.collection('slaBreaches').doc('breach-1').get())
  })

  it('denies any client write', async () => {
    const db = testEnv.authenticatedContext(SELLER_UID, { role: 'seller', sellerId: SELLER_ID }).firestore()
    await assertFails(db.collection('slaBreaches').doc('breach-1').update({ sellerId: OTHER_SELLER_ID }))
  })
})

describe('notificationPreferences/{userId}', () => {
  it('lets the owning user read their preferences', async () => {
    const db = testEnv.authenticatedContext(BUYER_UID).firestore()
    await assertSucceeds(db.collection('notificationPreferences').doc(BUYER_UID).get())
  })

  it("denies another user reading someone else's preferences", async () => {
    const db = testEnv.authenticatedContext(OTHER_BUYER_UID).firestore()
    await assertFails(db.collection('notificationPreferences').doc(BUYER_UID).get())
  })

  it('lets an admin read any preferences doc', async () => {
    const db = testEnv.authenticatedContext(ADMIN_UID, { role: 'admin' }).firestore()
    await assertSucceeds(db.collection('notificationPreferences').doc(BUYER_UID).get())
  })

  it('denies any client write, including the owner (updateNotificationPreferences callable only)', async () => {
    const db = testEnv.authenticatedContext(BUYER_UID).firestore()
    await assertFails(db.collection('notificationPreferences').doc(BUYER_UID).update({ marketingOptOut: true }))
  })
})

describe('notificationsDeadLetter/{deadLetterId}', () => {
  it('denies a regular user reading dead-letter records', async () => {
    const db = testEnv.authenticatedContext(BUYER_UID).firestore()
    await assertFails(db.collection('notificationsDeadLetter').doc('dl-1').get())
  })

  it('lets an admin read dead-letter records', async () => {
    const db = testEnv.authenticatedContext(ADMIN_UID, { role: 'admin' }).firestore()
    await assertSucceeds(db.collection('notificationsDeadLetter').doc('dl-1').get())
  })

  it('denies any client write, including admin', async () => {
    const db = testEnv.authenticatedContext(ADMIN_UID, { role: 'admin' }).firestore()
    await assertFails(db.collection('notificationsDeadLetter').doc('dl-1').update({ resolved: true }))
  })
})

describe('notificationRateCounters/{counterId}', () => {
  it('denies any client read or write, including admin', async () => {
    const userDb = testEnv.authenticatedContext(BUYER_UID).firestore()
    await assertFails(userDb.collection('notificationRateCounters').doc('counter-1').get())

    const adminDb = testEnv.authenticatedContext(ADMIN_UID, { role: 'admin' }).firestore()
    await assertFails(adminDb.collection('notificationRateCounters').doc('counter-1').get())
  })
})

