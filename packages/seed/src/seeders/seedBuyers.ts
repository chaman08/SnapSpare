import { creditAccountSchema, userSchema } from '@snapspare/shared'
import { BUYER_BLUEPRINTS } from '../data/buyers.js'
import { authAdmin, db } from '../lib/firebaseAdmin.js'

export async function seedBuyers(): Promise<void> {
  const now = Date.now()

  for (const blueprint of BUYER_BLUEPRINTS) {
    await authAdmin.createUser({
      uid: blueprint.id,
      phoneNumber: `+91${blueprint.phone}`,
      displayName: blueprint.displayName,
    })
    await authAdmin.setCustomUserClaims(blueprint.id, { role: 'buyer' })

    const { id: _userId, ...userDoc } = userSchema.parse({
      id: blueprint.id,
      phone: blueprint.phone,
      displayName: blueprint.displayName,
      roles: ['buyer'],
      primaryRole: 'buyer',
      buyerType: blueprint.buyerType,
      gstin: blueprint.gstin,
      fcmTokens: [],
      preferredLanguage: 'en',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    })
    await db.collection('users').doc(blueprint.id).set(userDoc)

    if (blueprint.creditLimitPaise !== undefined) {
      const creditAccountId = `credit-${blueprint.id}`
      const { id: _creditId, ...creditDoc } = creditAccountSchema.parse({
        id: creditAccountId,
        buyerId: blueprint.id,
        creditLimitPaise: blueprint.creditLimitPaise,
        availableCreditPaise: blueprint.creditLimitPaise,
        outstandingPaise: 0,
        dueDay: 5,
        status: 'active',
        approvedBy: 'admin-seed',
        approvedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      await db.collection('creditAccounts').doc(creditAccountId).set(creditDoc)
    }
  }

  console.log(`  buyers: ${BUYER_BLUEPRINTS.length} (buyerTypes covered, 1 with GSTIN, 1 with credit)`)
}
