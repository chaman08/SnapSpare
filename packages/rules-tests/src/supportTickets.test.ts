import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { createTestEnv } from './testEnv.js'

const BUYER_UID = 'buyer-1'
const OTHER_BUYER_UID = 'buyer-2'

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
    const db = context.firestore()

    await db.collection('supportTickets').doc('ticket-1').set({
      userId: BUYER_UID,
      contactName: 'Ravi Kumar',
      contactEmail: 'ravi@example.com',
      category: 'order_issue',
      subject: 'Where is my order?',
      status: 'open',
      messages: [{ authorRole: 'buyer', authorUserId: BUYER_UID, body: 'Where is my order?', createdAt: now }],
      slaBreachAt: now + 48 * 60 * 60 * 1000,
      createdAt: now,
      updatedAt: now,
    })

    await db.collection('supportTickets').doc('ticket-guest').set({
      contactName: 'Guest User',
      contactEmail: 'guest@example.com',
      category: 'account_access',
      subject: "Can't sign in",
      status: 'open',
      messages: [{ authorRole: 'buyer', body: "Can't sign in", createdAt: now }],
      slaBreachAt: now + 48 * 60 * 60 * 1000,
      createdAt: now,
      updatedAt: now,
    })
  })
})

describe('supportTickets — owner/admin read only, Cloud-Function-only writes', () => {
  it('lets the owning buyer read their own ticket', async () => {
    const db = testEnv.authenticatedContext(BUYER_UID).firestore()
    await assertSucceeds(db.collection('supportTickets').doc('ticket-1').get())
  })

  it('lets an admin read any ticket, including a guest one', async () => {
    const db = testEnv.authenticatedContext('admin-1', { role: 'admin' }).firestore()
    await assertSucceeds(db.collection('supportTickets').doc('ticket-1').get())
    await assertSucceeds(db.collection('supportTickets').doc('ticket-guest').get())
  })

  it('denies an unrelated buyer reading someone else\'s ticket', async () => {
    const db = testEnv.authenticatedContext(OTHER_BUYER_UID).firestore()
    await assertFails(db.collection('supportTickets').doc('ticket-1').get())
  })

  it('denies a signed-out read', async () => {
    const db = testEnv.unauthenticatedContext().firestore()
    await assertFails(db.collection('supportTickets').doc('ticket-1').get())
  })

  it('denies anyone reading a guest ticket directly (no owner uid to match)', async () => {
    const db = testEnv.authenticatedContext(BUYER_UID).firestore()
    await assertFails(db.collection('supportTickets').doc('ticket-guest').get())
  })

  it('denies a direct client create, even by a signed-in buyer (must go through createSupportTicket)', async () => {
    const db = testEnv.authenticatedContext(BUYER_UID).firestore()
    await assertFails(
      db.collection('supportTickets').doc('ticket-new').set({
        userId: BUYER_UID,
        contactName: 'Ravi Kumar',
        contactEmail: 'ravi@example.com',
        category: 'order_issue',
        subject: 'Test',
        status: 'open',
        messages: [{ authorRole: 'buyer', authorUserId: BUYER_UID, body: 'Test', createdAt: now }],
        slaBreachAt: now + 48 * 60 * 60 * 1000,
        createdAt: now,
        updatedAt: now,
      }),
    )
  })

  it('denies an admin replying via a direct update (must go through respondToSupportTicket)', async () => {
    const db = testEnv.authenticatedContext('admin-1', { role: 'admin' }).firestore()
    await assertFails(db.collection('supportTickets').doc('ticket-1').update({ status: 'in_progress' }))
  })
})
