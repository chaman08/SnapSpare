// Phase 11 GST invoicing & compliance collections: invoices, creditNotes,
// invoiceCounters, creditNoteCounters, sellerFyGrossSales, ewayBillTasks.
// Every write in this group is Cloud-Function/Admin-SDK only (see
// firestore.rules's "GST invoicing & compliance" section) — numbering, PDF
// generation and TCS/TDS ledger postings all have to be atomic and
// server-computed. invoices/creditNotes/ewayBillTasks are readable by their
// participants; the three counter collections are pure internal bookkeeping,
// closed to every client including admins.
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

    await db.collection('invoices').doc('invoice-1').set({
      buyerId: BUYER_UID,
      sellerId: SELLER_ID,
      orderId: 'order-1',
      subOrderId: 'suborder-1',
      invoiceNumber: 'INV-2026-000001',
      totalPaise: 118000,
      taxableValuePaise: 100000,
      gstPaise: 18000,
      pdfUrl: 'invoices/invoice-1.pdf',
      createdAt: now,
    })

    await db.collection('creditNotes').doc('cn-1').set({
      buyerId: BUYER_UID,
      sellerId: SELLER_ID,
      orderId: 'order-1',
      subOrderId: 'suborder-1',
      invoiceId: 'invoice-1',
      creditNoteNumber: 'CN-2026-000001',
      totalPaise: 59000,
      taxableValuePaise: 50000,
      gstPaise: 9000,
      pdfUrl: 'creditNotes/cn-1.pdf',
      createdAt: now,
    })

    await db.collection('invoiceCounters').doc('2026-27').set({ lastNumber: 1, updatedAt: now })
    await db.collection('creditNoteCounters').doc('2026-27').set({ lastNumber: 1, updatedAt: now })
    await db.collection('sellerFyGrossSales').doc(`${SELLER_ID}_2026-27`).set({
      sellerId: SELLER_ID,
      fy: '2026-27',
      grossSalesPaise: 5000000,
      updatedAt: now,
    })

    await db.collection('ewayBillTasks').doc('task-1').set({
      sellerId: SELLER_ID,
      subOrderId: 'suborder-1',
      consignmentValuePaise: 5500000,
      status: 'pending',
      ewayBillNumber: null,
      createdAt: now,
      updatedAt: now,
    })
  })
})

describe('invoices/{invoiceId} read', () => {
  it('lets the buyer read their own invoice', async () => {
    const db = testEnv.authenticatedContext(BUYER_UID).firestore()
    await assertSucceeds(db.collection('invoices').doc('invoice-1').get())
  })

  it('lets the owning seller read the invoice', async () => {
    const db = testEnv.authenticatedContext(SELLER_UID, { role: 'seller', sellerId: SELLER_ID }).firestore()
    await assertSucceeds(db.collection('invoices').doc('invoice-1').get())
  })

  it('lets an admin read any invoice', async () => {
    const db = testEnv.authenticatedContext(ADMIN_UID, { role: 'admin' }).firestore()
    await assertSucceeds(db.collection('invoices').doc('invoice-1').get())
  })

  it('denies an unrelated buyer reading the invoice', async () => {
    const db = testEnv.authenticatedContext(OTHER_BUYER_UID).firestore()
    await assertFails(db.collection('invoices').doc('invoice-1').get())
  })

  it('denies an unrelated seller reading the invoice', async () => {
    const db = testEnv.authenticatedContext(OTHER_SELLER_UID, { role: 'seller', sellerId: OTHER_SELLER_ID }).firestore()
    await assertFails(db.collection('invoices').doc('invoice-1').get())
  })

  it('denies a signed-out read', async () => {
    const db = testEnv.unauthenticatedContext().firestore()
    await assertFails(db.collection('invoices').doc('invoice-1').get())
  })
})

describe('invoices/{invoiceId} write — Cloud-Function-only', () => {
  it('denies any direct client write, even by the buyer, the seller or an admin', async () => {
    await assertFails(
      testEnv.authenticatedContext(BUYER_UID).firestore().collection('invoices').doc('invoice-1').update({ totalPaise: 1 }),
    )
    await assertFails(
      testEnv
        .authenticatedContext(SELLER_UID, { role: 'seller', sellerId: SELLER_ID })
        .firestore()
        .collection('invoices')
        .doc('invoice-1')
        .update({ totalPaise: 1 }),
    )
    await assertFails(
      testEnv.authenticatedContext(ADMIN_UID, { role: 'admin' }).firestore().collection('invoices').doc('invoice-1').update({ totalPaise: 1 }),
    )
  })
})

describe('creditNotes/{creditNoteId} read', () => {
  it('lets the buyer read their own credit note', async () => {
    const db = testEnv.authenticatedContext(BUYER_UID).firestore()
    await assertSucceeds(db.collection('creditNotes').doc('cn-1').get())
  })

  it('lets the owning seller read the credit note', async () => {
    const db = testEnv.authenticatedContext(SELLER_UID, { role: 'seller', sellerId: SELLER_ID }).firestore()
    await assertSucceeds(db.collection('creditNotes').doc('cn-1').get())
  })

  it('lets an admin read any credit note', async () => {
    const db = testEnv.authenticatedContext(ADMIN_UID, { role: 'admin' }).firestore()
    await assertSucceeds(db.collection('creditNotes').doc('cn-1').get())
  })

  it('denies an unrelated buyer or seller reading the credit note', async () => {
    await assertFails(testEnv.authenticatedContext(OTHER_BUYER_UID).firestore().collection('creditNotes').doc('cn-1').get())
    await assertFails(
      testEnv
        .authenticatedContext(OTHER_SELLER_UID, { role: 'seller', sellerId: OTHER_SELLER_ID })
        .firestore()
        .collection('creditNotes')
        .doc('cn-1')
        .get(),
    )
  })
})

describe('creditNotes/{creditNoteId} write — Cloud-Function-only', () => {
  it('denies any direct client write, even by the buyer or an admin', async () => {
    await assertFails(
      testEnv.authenticatedContext(BUYER_UID).firestore().collection('creditNotes').doc('cn-1').update({ totalPaise: 1 }),
    )
    await assertFails(
      testEnv.authenticatedContext(ADMIN_UID, { role: 'admin' }).firestore().collection('creditNotes').doc('cn-1').update({ totalPaise: 1 }),
    )
  })
})

describe.each([
  ['invoiceCounters', '2026-27'],
  ['creditNoteCounters', '2026-27'],
  ['sellerFyGrossSales', `${SELLER_ID}_2026-27`],
])('%s/{counterId} — internal bookkeeping, fully closed', (collection, docId) => {
  it('denies read for a signed-out client', async () => {
    const db = testEnv.unauthenticatedContext().firestore()
    await assertFails(db.collection(collection).doc(docId).get())
  })

  it('denies read for a signed-in buyer, the owning seller and an admin', async () => {
    await assertFails(testEnv.authenticatedContext(BUYER_UID).firestore().collection(collection).doc(docId).get())
    await assertFails(
      testEnv.authenticatedContext(SELLER_UID, { role: 'seller', sellerId: SELLER_ID }).firestore().collection(collection).doc(docId).get(),
    )
    await assertFails(testEnv.authenticatedContext(ADMIN_UID, { role: 'admin' }).firestore().collection(collection).doc(docId).get())
  })

  it('denies any write, including by an admin', async () => {
    await assertFails(
      testEnv.authenticatedContext(ADMIN_UID, { role: 'admin' }).firestore().collection(collection).doc(docId).update({ lastNumber: 999 }),
    )
  })
})

describe('ewayBillTasks/{ewayBillTaskId} read', () => {
  it('lets the owning seller read their task', async () => {
    const db = testEnv.authenticatedContext(SELLER_UID, { role: 'seller', sellerId: SELLER_ID }).firestore()
    await assertSucceeds(db.collection('ewayBillTasks').doc('task-1').get())
  })

  it('lets an admin read any task', async () => {
    const db = testEnv.authenticatedContext(ADMIN_UID, { role: 'admin' }).firestore()
    await assertSucceeds(db.collection('ewayBillTasks').doc('task-1').get())
  })

  it("denies another seller reading someone else's task", async () => {
    const db = testEnv.authenticatedContext(OTHER_SELLER_UID, { role: 'seller', sellerId: OTHER_SELLER_ID }).firestore()
    await assertFails(db.collection('ewayBillTasks').doc('task-1').get())
  })

  it('denies a signed-out read', async () => {
    const db = testEnv.unauthenticatedContext().firestore()
    await assertFails(db.collection('ewayBillTasks').doc('task-1').get())
  })
})

describe('ewayBillTasks/{ewayBillTaskId} write — markEwayBillGenerated callable only', () => {
  it('denies a direct client write, even by the owning seller', async () => {
    const db = testEnv.authenticatedContext(SELLER_UID, { role: 'seller', sellerId: SELLER_ID }).firestore()
    await assertFails(db.collection('ewayBillTasks').doc('task-1').update({ status: 'generated' }))
  })

  it('denies a direct client write by an admin too', async () => {
    const db = testEnv.authenticatedContext(ADMIN_UID, { role: 'admin' }).firestore()
    await assertFails(db.collection('ewayBillTasks').doc('task-1').update({ status: 'generated' }))
  })
})
