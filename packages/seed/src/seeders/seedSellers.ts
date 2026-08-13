import { addressSchema, sellerSchema, userSchema } from '@snapspare/shared'
import { buildGstin, SELLER_BLUEPRINTS } from '../data/sellers.js'
import { authAdmin, db } from '../lib/firebaseAdmin.js'
import { randomInt } from '../lib/random.js'

export async function seedSellers(rng: () => number): Promise<void> {
  const now = Date.now()

  for (const blueprint of SELLER_BLUEPRINTS) {
    await authAdmin.createUser({
      uid: blueprint.ownerUserId,
      phoneNumber: `+91${blueprint.ownerPhone}`,
      displayName: blueprint.ownerName,
    })
    await authAdmin.setCustomUserClaims(blueprint.ownerUserId, { role: 'seller', sellerId: blueprint.id })

    const { id: _userId, ...userDoc } = userSchema.parse({
      id: blueprint.ownerUserId,
      phone: blueprint.ownerPhone,
      displayName: blueprint.ownerName,
      roles: ['seller'],
      primaryRole: 'seller',
      fcmTokens: [],
      preferredLanguage: 'en',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    })
    await db.collection('users').doc(blueprint.ownerUserId).set(userDoc)

    const warehouseAddressId = 'warehouse'
    const { id: _addressId, ...addressDoc } = addressSchema.parse({
      id: warehouseAddressId,
      userId: blueprint.ownerUserId,
      label: 'Warehouse',
      contactName: blueprint.ownerName,
      contactPhone: blueprint.ownerPhone,
      line1: `Plot 1, ${blueprint.businessName} Industrial Estate`,
      city: blueprint.city,
      state: blueprint.stateName,
      stateCode: blueprint.stateCode,
      pincode: blueprint.pincode,
      gstin: buildGstin(blueprint.stateCode, blueprint.pan),
      isDefault: true,
      createdAt: now,
      updatedAt: now,
    })
    await db
      .collection('users')
      .doc(blueprint.ownerUserId)
      .collection('addresses')
      .doc(warehouseAddressId)
      .set(addressDoc)

    const { id: _sellerId, ...sellerDoc } = sellerSchema.parse({
      id: blueprint.id,
      ownerUserId: blueprint.ownerUserId,
      businessName: blueprint.businessName,
      legalName: blueprint.legalName,
      gstin: buildGstin(blueprint.stateCode, blueprint.pan),
      pan: blueprint.pan,
      businessType: blueprint.businessType,
      status: 'active',
      ratingAvg: Math.round((3.5 + rng() * 1.5) * 10) / 10,
      ratingCount: randomInt(rng, 0, 400),
      warehouseAddressId,
      bankAccount: blueprint.bankAccount,
      commissionRatePercent: 8,
      categorySlugs: blueprint.categorySlugs,
      onboardedAt: now,
      createdAt: now,
      updatedAt: now,
    })
    await db.collection('sellers').doc(blueprint.id).set(sellerDoc)
  }

  console.log(`  sellers: ${SELLER_BLUEPRINTS.length} (with owner users + warehouse addresses)`)
}
