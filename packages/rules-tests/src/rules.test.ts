import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createTestEnv, RULES_PATH } from './testEnv.js'

const OWNER_UID = 'buyer-owner'
const OTHER_UID = 'buyer-other'
const ADMIN_UID = 'admin-user'
const SELLER_UID = 'seller-user'
const SELLER_ID = 'seller-123'

const now = 1_700_000_000_000

function baseUserDoc(overrides: Record<string, unknown> = {}) {
  return {
    phone: '9876543210',
    displayName: 'Test Buyer',
    roles: ['buyer'],
    primaryRole: 'buyer',
    buyerType: 'retail',
    fcmTokens: [],
    preferredLanguage: 'en',
    status: 'active',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

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
    await db.collection('users').doc(OWNER_UID).set(baseUserDoc())
    await db.collection('users').doc(OTHER_UID).set(baseUserDoc({ displayName: 'Other Buyer' }))
    await db.collection('sellers').doc(SELLER_ID).set({
      ownerUserId: SELLER_UID,
      businessName: 'Test Seller',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    })
  })
})

describe('users/{userId}', () => {
  it('lets a signed-in user read their own document', async () => {
    const db = testEnv.authenticatedContext(OWNER_UID).firestore()
    await assertSucceeds(db.collection('users').doc(OWNER_UID).get())
  })

  it('denies a user reading someone else\'s document', async () => {
    const db = testEnv.authenticatedContext(OWNER_UID).firestore()
    await assertFails(db.collection('users').doc(OTHER_UID).get())
  })

  it('denies an unauthenticated read', async () => {
    const db = testEnv.unauthenticatedContext().firestore()
    await assertFails(db.collection('users').doc(OWNER_UID).get())
  })

  it('lets an admin read any user document', async () => {
    const db = testEnv.authenticatedContext(ADMIN_UID, { role: 'admin' }).firestore()
    await assertSucceeds(db.collection('users').doc(OWNER_UID).get())
    await assertSucceeds(db.collection('users').doc(OTHER_UID).get())
  })

  it('lets the owner update self-declared fields (displayName, buyerType, gstin)', async () => {
    const db = testEnv.authenticatedContext(OWNER_UID).firestore()
    await assertSucceeds(
      db
        .collection('users')
        .doc(OWNER_UID)
        .update({ displayName: 'Updated Name', buyerType: 'garage', updatedAt: now + 1 }),
    )
  })

  it('denies the owner writing roles, primaryRole, or status on their own document', async () => {
    const db = testEnv.authenticatedContext(OWNER_UID).firestore()
    await assertFails(
      db.collection('users').doc(OWNER_UID).update({ roles: ['buyer', 'admin'] }),
    )
    await assertFails(db.collection('users').doc(OWNER_UID).update({ primaryRole: 'admin' }))
    await assertFails(db.collection('users').doc(OWNER_UID).update({ status: 'suspended' }))
  })

  it('denies one user writing to another user\'s document', async () => {
    const db = testEnv.authenticatedContext(OTHER_UID).firestore()
    await assertFails(
      db.collection('users').doc(OWNER_UID).update({ displayName: 'Hijacked' }),
    )
  })

  it('denies a client creating a user document directly', async () => {
    const db = testEnv.authenticatedContext('brand-new-uid').firestore()
    await assertFails(db.collection('users').doc('brand-new-uid').set(baseUserDoc()))
  })

  it('denies deleting a user document', async () => {
    const db = testEnv.authenticatedContext(OWNER_UID).firestore()
    await assertFails(db.collection('users').doc(OWNER_UID).delete())
  })
})

describe('users/{userId}/addresses/{addressId}', () => {
  it('lets the owner create, read, and delete their own address', async () => {
    const db = testEnv.authenticatedContext(OWNER_UID).firestore()
    const addressRef = db.collection('users').doc(OWNER_UID).collection('addresses').doc('addr-1')
    await assertSucceeds(
      addressRef.set({
        label: 'Home',
        contactName: 'Test Buyer',
        contactPhone: '9876543210',
        line1: '123 Main St',
        city: 'Bengaluru',
        state: 'Karnataka',
        stateCode: '29',
        pincode: '560001',
        isDefault: false,
        createdAt: now,
        updatedAt: now,
      }),
    )
    await assertSucceeds(addressRef.get())
    await assertSucceeds(addressRef.delete())
  })

  it("denies another user reading or writing someone else's address", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context
        .firestore()
        .collection('users')
        .doc(OWNER_UID)
        .collection('addresses')
        .doc('addr-1')
        .set({
          label: 'Home',
          contactName: 'Test Buyer',
          contactPhone: '9876543210',
          line1: '123 Main St',
          city: 'Bengaluru',
          state: 'Karnataka',
          stateCode: '29',
          pincode: '560001',
          isDefault: false,
          createdAt: now,
          updatedAt: now,
        })
    })

    const db = testEnv.authenticatedContext(OTHER_UID).firestore()
    const addressRef = db.collection('users').doc(OWNER_UID).collection('addresses').doc('addr-1')
    await assertFails(addressRef.get())
    await assertFails(addressRef.update({ label: 'Hijacked' }))
    await assertFails(addressRef.delete())
  })
})

describe('users/{userId}/vehicles/{vehicleId}', () => {
  it('lets the owner create and read their own garage vehicle', async () => {
    const db = testEnv.authenticatedContext(OWNER_UID).firestore()
    const vehicleRef = db.collection('users').doc(OWNER_UID).collection('vehicles').doc('veh-1')
    await assertSucceeds(
      vehicleRef.set({
        makeId: 'maruti-suzuki',
        makeName: 'Maruti Suzuki',
        modelId: 'swift',
        modelName: 'Swift',
        variantId: 'vxi',
        variantName: 'VXI',
        isPrimary: false,
        createdAt: now,
        updatedAt: now,
      }),
    )
    await assertSucceeds(vehicleRef.get())
  })

  it("denies another user reading or writing someone else's garage vehicle", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context
        .firestore()
        .collection('users')
        .doc(OWNER_UID)
        .collection('vehicles')
        .doc('veh-1')
        .set({
          makeId: 'maruti-suzuki',
          makeName: 'Maruti Suzuki',
          modelId: 'swift',
          modelName: 'Swift',
          variantId: 'vxi',
          variantName: 'VXI',
          isPrimary: false,
          createdAt: now,
          updatedAt: now,
        })
    })

    const db = testEnv.authenticatedContext(OTHER_UID).firestore()
    const vehicleRef = db.collection('users').doc(OWNER_UID).collection('vehicles').doc('veh-1')
    await assertFails(vehicleRef.get())
    await assertFails(vehicleRef.delete())
  })
})

describe('sellers/{sellerId}', () => {
  it('lets the matching seller (via custom claim) read their own seller doc', async () => {
    const db = testEnv
      .authenticatedContext(SELLER_UID, { role: 'seller', sellerId: SELLER_ID })
      .firestore()
    await assertSucceeds(db.collection('sellers').doc(SELLER_ID).get())
  })

  it("denies a buyer reading a seller doc that isn't theirs", async () => {
    const db = testEnv.authenticatedContext(OWNER_UID).firestore()
    await assertFails(db.collection('sellers').doc(SELLER_ID).get())
  })

  it('denies writing to a seller doc from the client entirely', async () => {
    const db = testEnv
      .authenticatedContext(SELLER_UID, { role: 'seller', sellerId: SELLER_ID })
      .firestore()
    await assertFails(db.collection('sellers').doc(SELLER_ID).update({ status: 'active' }))
  })
})

describe('everything else stays closed by default', () => {
  it('denies reading an arbitrary unopened collection', async () => {
    const db = testEnv.authenticatedContext(OWNER_UID).firestore()
    await assertFails(db.collection('orders').doc('order-1').get())
  })
})

it('sanity: the rules file actually loaded (non-empty)', () => {
  expect(readFileSync(RULES_PATH, 'utf8').length).toBeGreaterThan(0)
})
