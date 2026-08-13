import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { createTestEnv } from './testEnv.js'

const REPORTER_UID = 'buyer-1'
const OTHER_BUYER_UID = 'buyer-2'
const SELLER_UID = 'seller-1-owner'
const SELLER_ID = 'seller-1'
const OTHER_SELLER_UID = 'seller-2-owner'
const OTHER_SELLER_ID = 'seller-2'
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
    const db = context.firestore()

    await db.collection('spuriousReports').doc('report-1').set({
      reporterId: REPORTER_UID,
      listingId: 'listing-1',
      partId: 'part-1',
      sellerId: SELLER_ID,
      reasonNotes: 'Packaging looked off',
      evidenceImages: [],
      status: 'submitted',
      createdAt: now,
      updatedAt: now,
    })

    await db.collection('brandAuthorizations').doc('auth-1').set({
      sellerId: SELLER_ID,
      brandName: 'Bosch',
      documentUrl: 'sellers/seller-1/brandAuthorizations/doc.pdf',
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    })

    await db.collection('authenticityScans').doc('scan-1').set({
      scannedBy: REPORTER_UID,
      code: 'ABC123',
      valid: false,
      createdAt: now,
    })
  })
})

describe('spuriousReports — Cloud-Function-only writes', () => {
  it('lets the reporter, the accused seller and admin read the report', async () => {
    await assertSucceeds(testEnv.authenticatedContext(REPORTER_UID).firestore().collection('spuriousReports').doc('report-1').get())
    await assertSucceeds(
      testEnv.authenticatedContext(SELLER_UID, { role: 'seller', sellerId: SELLER_ID }).firestore().collection('spuriousReports').doc('report-1').get(),
    )
    await assertSucceeds(
      testEnv.authenticatedContext(ADMIN_UID, { role: 'admin' }).firestore().collection('spuriousReports').doc('report-1').get(),
    )
  })

  it('denies an unrelated buyer or seller reading the report', async () => {
    await assertFails(testEnv.authenticatedContext(OTHER_BUYER_UID).firestore().collection('spuriousReports').doc('report-1').get())
    await assertFails(
      testEnv
        .authenticatedContext(OTHER_SELLER_UID, { role: 'seller', sellerId: OTHER_SELLER_ID })
        .firestore()
        .collection('spuriousReports')
        .doc('report-1')
        .get(),
    )
  })

  it('denies any direct client write, even by the reporter (must go through reportSpuriousPart.ts)', async () => {
    const db = testEnv.authenticatedContext(REPORTER_UID).firestore()
    await assertFails(db.collection('spuriousReports').doc('report-1').update({ status: 'resolved' }))
  })
})

describe('brandAuthorizations — Cloud-Function-only writes', () => {
  it('lets the owning seller and admin read the authorization', async () => {
    await assertSucceeds(
      testEnv.authenticatedContext(SELLER_UID, { role: 'seller', sellerId: SELLER_ID }).firestore().collection('brandAuthorizations').doc('auth-1').get(),
    )
    await assertSucceeds(
      testEnv.authenticatedContext(ADMIN_UID, { role: 'admin' }).firestore().collection('brandAuthorizations').doc('auth-1').get(),
    )
  })

  it('denies an unrelated seller reading the authorization', async () => {
    await assertFails(
      testEnv
        .authenticatedContext(OTHER_SELLER_UID, { role: 'seller', sellerId: OTHER_SELLER_ID })
        .firestore()
        .collection('brandAuthorizations')
        .doc('auth-1')
        .get(),
    )
  })

  it('denies a direct client write, even by the owning seller (must go through submitBrandAuthorization.ts)', async () => {
    const db = testEnv.authenticatedContext(SELLER_UID, { role: 'seller', sellerId: SELLER_ID }).firestore()
    await assertFails(db.collection('brandAuthorizations').doc('auth-1').update({ status: 'verified' }))
  })
})

describe('authenticityScans — self-read only, Cloud-Function-only writes', () => {
  it('lets the scanning user read their own scan', async () => {
    await assertSucceeds(testEnv.authenticatedContext(REPORTER_UID).firestore().collection('authenticityScans').doc('scan-1').get())
  })

  it("denies another user reading someone else's scan", async () => {
    await assertFails(testEnv.authenticatedContext(OTHER_BUYER_UID).firestore().collection('authenticityScans').doc('scan-1').get())
  })

  it('denies any direct client write', async () => {
    const db = testEnv.authenticatedContext(REPORTER_UID).firestore()
    await assertFails(db.collection('authenticityScans').doc('scan-new').set({ scannedBy: REPORTER_UID, code: 'X', valid: false, createdAt: now }))
  })
})
