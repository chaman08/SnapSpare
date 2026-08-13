import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { createTestEnv } from './testEnv.js'

const ADMIN_UID = 'admin-1'
const OWNER_UID = 'owner-1'
const OTHER_UID = 'other-1'
const STAFF_UID = 'staff-1'
const SELLER_ID = OWNER_UID // Phase 13: sellerId == ownerUserId by design

let testEnv: RulesTestEnvironment

beforeAll(async () => {
  testEnv = await createTestEnv()
})

afterAll(async () => {
  await testEnv.cleanup()
})

beforeEach(async () => {
  await testEnv.clearFirestore()
})

describe('sellerApplications', () => {
  it('lets the owner create their own draft application', async () => {
    const db = testEnv.authenticatedContext(OWNER_UID).firestore()
    await assertSucceeds(
      db.collection('sellerApplications').doc(OWNER_UID).set({
        ownerUserId: OWNER_UID,
        status: 'draft',
        currentStep: 1,
        pickupAddresses: [],
        reviewNotes: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    )
  })

  it('denies creating a draft application under someone else\'s uid', async () => {
    const db = testEnv.authenticatedContext(OWNER_UID).firestore()
    await assertFails(
      db.collection('sellerApplications').doc(OTHER_UID).set({
        ownerUserId: OTHER_UID,
        status: 'draft',
        currentStep: 1,
        pickupAddresses: [],
        reviewNotes: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    )
  })

  it('lets the owner keep editing a draft, but not touch status directly', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection('sellerApplications').doc(OWNER_UID).set({
        ownerUserId: OWNER_UID,
        status: 'draft',
        currentStep: 1,
        pickupAddresses: [],
        reviewNotes: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
    })

    const db = testEnv.authenticatedContext(OWNER_UID).firestore()
    await assertSucceeds(
      db.collection('sellerApplications').doc(OWNER_UID).update({ currentStep: 2, updatedAt: Date.now() }),
    )
    await assertFails(
      db.collection('sellerApplications').doc(OWNER_UID).update({ status: 'approved' }),
    )
  })

  it('denies the owner writing once the application is submitted', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection('sellerApplications').doc(OWNER_UID).set({
        ownerUserId: OWNER_UID,
        status: 'submitted',
        currentStep: 6,
        pickupAddresses: [],
        reviewNotes: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
    })

    const db = testEnv.authenticatedContext(OWNER_UID).firestore()
    await assertFails(db.collection('sellerApplications').doc(OWNER_UID).update({ currentStep: 5 }))
  })

  it('denies another signed-in user reading someone else\'s application', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection('sellerApplications').doc(OWNER_UID).set({
        ownerUserId: OWNER_UID,
        status: 'draft',
        currentStep: 1,
        pickupAddresses: [],
        reviewNotes: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
    })

    const db = testEnv.authenticatedContext(OTHER_UID).firestore()
    await assertFails(db.collection('sellerApplications').doc(OWNER_UID).get())
  })

  it('lets an admin read any application but never write it directly', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection('sellerApplications').doc(OWNER_UID).set({
        ownerUserId: OWNER_UID,
        status: 'submitted',
        currentStep: 6,
        pickupAddresses: [],
        reviewNotes: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
    })

    const db = testEnv.authenticatedContext(ADMIN_UID, { role: 'admin' }).firestore()
    await assertSucceeds(db.collection('sellerApplications').doc(OWNER_UID).get())
    await assertFails(db.collection('sellerApplications').doc(OWNER_UID).update({ status: 'approved' }))
  })
})

describe('sellers/{sellerId}/pickupAddresses', () => {
  it('lets the seller owner write their own pickup addresses', async () => {
    const db = testEnv.authenticatedContext(OWNER_UID, { role: 'seller', sellerId: SELLER_ID }).firestore()
    await assertSucceeds(
      db.collection('sellers').doc(SELLER_ID).collection('pickupAddresses').doc('addr-1').set({ label: 'Warehouse' }),
    )
  })

  it('denies a packer-only staff member (no manage_listings) from writing pickup addresses', async () => {
    const db = testEnv
      .authenticatedContext(STAFF_UID, { role: 'seller', sellerId: SELLER_ID, staffRole: 'packer', permissions: ['manage_orders'] })
      .firestore()
    await assertFails(
      db.collection('sellers').doc(SELLER_ID).collection('pickupAddresses').doc('addr-1').set({ label: 'Warehouse' }),
    )
  })

  it('lets a manager staff member with manage_listings write pickup addresses', async () => {
    const db = testEnv
      .authenticatedContext(STAFF_UID, { role: 'seller', sellerId: SELLER_ID, staffRole: 'manager', permissions: ['manage_listings'] })
      .firestore()
    await assertSucceeds(
      db.collection('sellers').doc(SELLER_ID).collection('pickupAddresses').doc('addr-1').set({ label: 'Warehouse' }),
    )
  })

  it('denies an unrelated seller from reading another seller\'s pickup addresses', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection('sellers').doc(SELLER_ID).collection('pickupAddresses').doc('addr-1').set({ label: 'Warehouse' })
    })
    const db = testEnv.authenticatedContext(OTHER_UID, { role: 'seller', sellerId: 'some-other-seller' }).firestore()
    await assertFails(db.collection('sellers').doc(SELLER_ID).collection('pickupAddresses').doc('addr-1').get())
  })
})

describe('sellers/{sellerId}/settings', () => {
  it('lets the owner update non-holidayMode settings fields', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection('sellers').doc(SELLER_ID).collection('settings').doc('general').set({
        holidayMode: { active: false },
        updatedAt: Date.now(),
      })
    })
    const db = testEnv.authenticatedContext(OWNER_UID, { role: 'seller', sellerId: SELLER_ID }).firestore()
    await assertSucceeds(
      db.collection('sellers').doc(SELLER_ID).collection('settings').doc('general').update({
        storeName: 'Aurangabad Auto Spares',
        updatedAt: Date.now(),
      }),
    )
  })

  it('denies the owner changing holidayMode directly (must go through setHolidayMode callable)', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection('sellers').doc(SELLER_ID).collection('settings').doc('general').set({
        holidayMode: { active: false },
        updatedAt: Date.now(),
      })
    })
    const db = testEnv.authenticatedContext(OWNER_UID, { role: 'seller', sellerId: SELLER_ID }).firestore()
    await assertFails(
      db.collection('sellers').doc(SELLER_ID).collection('settings').doc('general').update({
        holidayMode: { active: true },
      }),
    )
  })

  it('denies the owner changing storeSlug directly (must go through setStoreSlug callable)', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection('sellers').doc(SELLER_ID).collection('settings').doc('general').set({
        holidayMode: { active: false },
        storeSlug: 'aurangabad-auto',
        updatedAt: Date.now(),
      })
    })
    const db = testEnv.authenticatedContext(OWNER_UID, { role: 'seller', sellerId: SELLER_ID }).firestore()
    await assertFails(
      db.collection('sellers').doc(SELLER_ID).collection('settings').doc('general').update({
        storeSlug: 'someone-else',
      }),
    )
  })

  it('lets a signed-out buyer read the settings doc (Phase 14 M9: public store page)', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection('sellers').doc(SELLER_ID).collection('settings').doc('general').set({
        holidayMode: { active: false },
        businessName: 'Aurangabad Auto Spares',
        storeSlug: 'aurangabad-auto',
        updatedAt: Date.now(),
      })
    })
    const db = testEnv.unauthenticatedContext().firestore()
    await assertSucceeds(db.collection('sellers').doc(SELLER_ID).collection('settings').doc('general').get())
  })
})

describe('sellerStaff', () => {
  it('denies any direct client write, even from the owner', async () => {
    const db = testEnv.authenticatedContext(OWNER_UID, { role: 'seller', sellerId: SELLER_ID }).firestore()
    await assertFails(
      db.collection('sellerStaff').doc('staff-doc-1').set({
        sellerId: SELLER_ID,
        name: 'Ramesh',
        phone: '9876543210',
        role: 'packer',
        permissions: ['manage_orders'],
        status: 'invited',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    )
  })

  it('lets the seller owner read their own staff roster', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection('sellerStaff').doc('staff-doc-1').set({
        sellerId: SELLER_ID,
        name: 'Ramesh',
        phone: '9876543210',
        role: 'packer',
        permissions: ['manage_orders'],
        status: 'invited',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
    })
    const db = testEnv.authenticatedContext(OWNER_UID, { role: 'seller', sellerId: SELLER_ID }).firestore()
    await assertSucceeds(db.collection('sellerStaff').doc('staff-doc-1').get())
  })

  it('denies an unrelated seller reading another seller\'s staff roster', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection('sellerStaff').doc('staff-doc-1').set({
        sellerId: SELLER_ID,
        name: 'Ramesh',
        phone: '9876543210',
        role: 'packer',
        permissions: ['manage_orders'],
        status: 'invited',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
    })
    const db = testEnv.authenticatedContext(OTHER_UID, { role: 'seller', sellerId: 'some-other-seller' }).firestore()
    await assertFails(db.collection('sellerStaff').doc('staff-doc-1').get())
  })
})
