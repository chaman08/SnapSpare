import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { createTestEnv } from './testEnv.js'

const ADMIN_UID = 'admin-1'
const BUYER_UID = 'buyer-1'

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
    await db.collection('vehicleMakes').doc('maruti-suzuki').set({ name: 'Maruti Suzuki', slug: 'maruti-suzuki', vehicleClass: 'passenger_car', status: 'active' })
    await db.collection('vehicleModels').doc('maruti-suzuki-swift').set({ makeId: 'maruti-suzuki', name: 'Swift', slug: 'swift', vehicleClass: 'passenger_car', yearFrom: 2005, status: 'active' })
    await db.collection('vehicleVariants').doc('maruti-suzuki-swift-vxi').set({ makeId: 'maruti-suzuki', modelId: 'maruti-suzuki-swift', name: 'VXI', slug: 'vxi', fuelType: 'petrol', transmission: 'manual', yearFrom: 2005, status: 'active' })
    await db.collection('catalogParts').doc('part-1').set({ partNumber: 'BRK-000001', partType: 'aftermarket', categorySlug: 'brake', name: 'Brake Pad', hsnCode: '8708', gstRatePercent: 28, status: 'active' })
    await db.collection('catalogFitments').doc('fitment-1').set({ partId: 'part-1', makeId: 'maruti-suzuki', modelId: 'maruti-suzuki-swift', variantId: 'maruti-suzuki-swift-vxi' })
    await db.collection('config').doc('app').set({ platformCommissionDefaultPercent: 8, maintenanceMode: false, featureFlags: {}, updatedAt: Date.now() })
    await db.collection('config').doc('app').collection('private').doc('secrets').set({ razorpayKeyId: 'rzp_test_x' })
    await db.collection('config').doc('commission').set({ categoryRates: {}, promotions: [], settlementCycleDays: 7, creditOverdueGraceDays: 7, updatedAt: Date.now() })
    await db.collection('pincodes').doc('400001').set({ city: 'Mumbai', state: 'Maharashtra', stateCode: '27' })
  })
})

describe('master catalog + vehicle data', () => {
  const collections = ['vehicleMakes', 'vehicleModels', 'vehicleVariants', 'catalogParts', 'catalogFitments']
  const docIds: Record<string, string> = {
    vehicleMakes: 'maruti-suzuki',
    vehicleModels: 'maruti-suzuki-swift',
    vehicleVariants: 'maruti-suzuki-swift-vxi',
    catalogParts: 'part-1',
    catalogFitments: 'fitment-1',
  }

  it('lets an unauthenticated client read every master collection', async () => {
    const db = testEnv.unauthenticatedContext().firestore()
    for (const collection of collections) {
      await assertSucceeds(db.collection(collection).doc(docIds[collection] as string).get())
    }
  })

  it('denies a signed-in buyer writing to any master collection', async () => {
    const db = testEnv.authenticatedContext(BUYER_UID).firestore()
    for (const collection of collections) {
      await assertFails(db.collection(collection).doc(docIds[collection] as string).set({ status: 'inactive' }))
    }
  })

  it('lets an admin write to every master collection', async () => {
    const db = testEnv.authenticatedContext(ADMIN_UID, { role: 'admin' }).firestore()
    await assertSucceeds(
      db.collection('catalogParts').doc('part-1').set({ partNumber: 'BRK-000001', partType: 'aftermarket', categorySlug: 'brake', name: 'Brake Pad', hsnCode: '8708', gstRatePercent: 28, status: 'inactive' }),
    )
  })
})

describe('config', () => {
  it('lets anyone read the public config doc', async () => {
    const db = testEnv.unauthenticatedContext().firestore()
    await assertSucceeds(db.collection('config').doc('app').get())
  })

  it('denies a non-admin writing to the public config doc', async () => {
    const db = testEnv.authenticatedContext(BUYER_UID).firestore()
    await assertFails(db.collection('config').doc('app').update({ maintenanceMode: true }))
  })

  it('lets an admin write the public config doc', async () => {
    const db = testEnv.authenticatedContext(ADMIN_UID, { role: 'admin' }).firestore()
    await assertSucceeds(db.collection('config').doc('app').update({ maintenanceMode: true }))
  })

  it('denies a non-admin reading the private config subdoc', async () => {
    const db = testEnv.authenticatedContext(BUYER_UID).firestore()
    await assertFails(db.collection('config').doc('app').collection('private').doc('secrets').get())
  })

  it('lets an admin read the private config subdoc', async () => {
    const db = testEnv.authenticatedContext(ADMIN_UID, { role: 'admin' }).firestore()
    await assertSucceeds(db.collection('config').doc('app').collection('private').doc('secrets').get())
  })
})

// Phase 14: config/commission is a literal override of the config/{configId}
// wildcard match above — Firestore resolves the most specific matching path
// per request, so this narrower rule wins for exactly this document without
// touching config/app/config/tax/config/shipping's public read.
describe('config/commission — locked down (Phase 14)', () => {
  it('denies an unauthenticated read', async () => {
    const db = testEnv.unauthenticatedContext().firestore()
    await assertFails(db.collection('config').doc('commission').get())
  })

  it('denies a signed-in buyer read', async () => {
    const db = testEnv.authenticatedContext(BUYER_UID).firestore()
    await assertFails(db.collection('config').doc('commission').get())
  })

  it('denies a signed-in seller read', async () => {
    const db = testEnv.authenticatedContext('seller-owner-1', { role: 'seller', sellerId: 'seller-1' }).firestore()
    await assertFails(db.collection('config').doc('commission').get())
  })

  it('lets an admin read', async () => {
    const db = testEnv.authenticatedContext(ADMIN_UID, { role: 'admin' }).firestore()
    await assertSucceeds(db.collection('config').doc('commission').get())
  })

  it('denies a non-admin write', async () => {
    const db = testEnv.authenticatedContext(BUYER_UID).firestore()
    await assertFails(db.collection('config').doc('commission').update({ settlementCycleDays: 14 }))
  })

  it('lets an admin write', async () => {
    const db = testEnv.authenticatedContext(ADMIN_UID, { role: 'admin' }).firestore()
    await assertSucceeds(db.collection('config').doc('commission').update({ settlementCycleDays: 14 }))
  })

  it('does not disturb config/app or config/tax staying public (sibling wildcard match)', async () => {
    const db = testEnv.unauthenticatedContext().firestore()
    await assertSucceeds(db.collection('config').doc('app').get())
  })
})

describe('pincodes — master data locked to the lookupPincode callable', () => {
  it('denies a direct client read even when signed in', async () => {
    const db = testEnv.authenticatedContext(BUYER_UID).firestore()
    await assertFails(db.collection('pincodes').doc('400001').get())
  })

  it('denies an unauthenticated read', async () => {
    const db = testEnv.unauthenticatedContext().firestore()
    await assertFails(db.collection('pincodes').doc('400001').get())
  })

  it('lets an admin manage the pincode master directly', async () => {
    const db = testEnv.authenticatedContext(ADMIN_UID, { role: 'admin' }).firestore()
    await assertSucceeds(
      db.collection('pincodes').doc('400002').set({ city: 'Mumbai', state: 'Maharashtra', stateCode: '27' }),
    )
  })
})
