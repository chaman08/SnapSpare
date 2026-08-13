// Phase 19: admin console audit trail (functions/src/util/auditLog.ts).
// Append-only — read is admin-only, and write stays `false` even for an
// admin (only writeAuditLog(), via the Admin SDK, appends), so a direct
// admin client write can never silently skip the audit trail.
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { createTestEnv } from './testEnv.js'

const BUYER_UID = 'buyer-1'
const ADMIN_UID = 'admin-1'
const OTHER_ADMIN_UID = 'admin-2'

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
    await context.firestore().collection('auditLogs').doc('log-1').set({
      actorId: ADMIN_UID,
      action: 'listing.blocked',
      targetType: 'listing',
      targetId: 'listing-1',
      createdAt: now,
    })
  })
})

describe('auditLogs/{auditLogId} read', () => {
  it('lets an admin read an audit log entry', async () => {
    const db = testEnv.authenticatedContext(ADMIN_UID, { role: 'admin' }).firestore()
    await assertSucceeds(db.collection('auditLogs').doc('log-1').get())
  })

  it('lets any admin (not just the acting one) read an audit log entry', async () => {
    const db = testEnv.authenticatedContext(OTHER_ADMIN_UID, { role: 'admin' }).firestore()
    await assertSucceeds(db.collection('auditLogs').doc('log-1').get())
  })

  it('denies a signed-in non-admin reading an audit log entry', async () => {
    const db = testEnv.authenticatedContext(BUYER_UID).firestore()
    await assertFails(db.collection('auditLogs').doc('log-1').get())
  })

  it('denies a signed-out read', async () => {
    const db = testEnv.unauthenticatedContext().firestore()
    await assertFails(db.collection('auditLogs').doc('log-1').get())
  })
})

describe('auditLogs/{auditLogId} write — writeAuditLog() (Admin SDK) only', () => {
  it('denies a direct client create, even by an admin', async () => {
    const db = testEnv.authenticatedContext(ADMIN_UID, { role: 'admin' }).firestore()
    await assertFails(
      db.collection('auditLogs').doc('log-2').set({
        actorId: ADMIN_UID,
        action: 'listing.blocked',
        targetType: 'listing',
        targetId: 'listing-2',
        createdAt: now,
      }),
    )
  })

  it('denies a direct client update, even by an admin', async () => {
    const db = testEnv.authenticatedContext(ADMIN_UID, { role: 'admin' }).firestore()
    await assertFails(db.collection('auditLogs').doc('log-1').update({ action: 'tampered' }))
  })

  it('denies a direct client delete, even by an admin', async () => {
    const db = testEnv.authenticatedContext(ADMIN_UID, { role: 'admin' }).firestore()
    await assertFails(db.collection('auditLogs').doc('log-1').delete())
  })
})
