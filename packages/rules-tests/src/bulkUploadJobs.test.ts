import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { createTestEnv } from './testEnv.js'

const SELLER_A_UID = 'seller-a-owner'
const SELLER_A_ID = 'seller-a'
const SELLER_B_UID = 'seller-b-owner'
const SELLER_B_ID = 'seller-b'
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
    await context.firestore().collection('bulkUploadJobs').doc('job-a').set({
      sellerId: SELLER_A_ID,
      status: 'ready_for_review',
      sourceStoragePath: `sellers/${SELLER_A_ID}/bulkUploads/source.xlsx`,
      totalRows: 2,
      validRows: 1,
      invalidRows: 1,
      committedRows: 0,
      rows: [],
      createdAt: now,
      updatedAt: now,
    })
  })
})

describe('bulkUploadJobs/{jobId} read', () => {
  it('lets the owning seller read their own job', async () => {
    const db = testEnv.authenticatedContext(SELLER_A_UID, { role: 'seller', sellerId: SELLER_A_ID }).firestore()
    await assertSucceeds(db.collection('bulkUploadJobs').doc('job-a').get())
  })

  it("denies a different seller reading another seller's job", async () => {
    const db = testEnv.authenticatedContext(SELLER_B_UID, { role: 'seller', sellerId: SELLER_B_ID }).firestore()
    await assertFails(db.collection('bulkUploadJobs').doc('job-a').get())
  })

  it('denies a signed-out read', async () => {
    const db = testEnv.unauthenticatedContext().firestore()
    await assertFails(db.collection('bulkUploadJobs').doc('job-a').get())
  })

  it('lets an admin read any job', async () => {
    const db = testEnv.authenticatedContext(ADMIN_UID, { role: 'admin' }).firestore()
    await assertSucceeds(db.collection('bulkUploadJobs').doc('job-a').get())
  })

  it('denies a seller staff member without manage_listings permission', async () => {
    const db = testEnv
      .authenticatedContext(SELLER_A_UID, { role: 'seller', sellerId: SELLER_A_ID, staffRole: 'staff', permissions: ['view_orders'] })
      .firestore()
    await assertFails(db.collection('bulkUploadJobs').doc('job-a').get())
  })
})

describe('bulkUploadJobs/{jobId} write — callable-only', () => {
  it('denies a direct client create, even by the owning seller', async () => {
    const db = testEnv.authenticatedContext(SELLER_A_UID, { role: 'seller', sellerId: SELLER_A_ID }).firestore()
    await assertFails(
      db.collection('bulkUploadJobs').doc('job-b').set({
        sellerId: SELLER_A_ID,
        status: 'ready_for_review',
        sourceStoragePath: `sellers/${SELLER_A_ID}/bulkUploads/other.xlsx`,
        totalRows: 0,
        validRows: 0,
        invalidRows: 0,
        committedRows: 0,
        rows: [],
        createdAt: now,
        updatedAt: now,
      }),
    )
  })

  it('denies a direct client write by an admin too — parseBulkListingUpload/commitBulkListingUpload are the only writers', async () => {
    const db = testEnv.authenticatedContext(ADMIN_UID, { role: 'admin' }).firestore()
    await assertFails(db.collection('bulkUploadJobs').doc('job-a').update({ status: 'committed' }))
  })
})
