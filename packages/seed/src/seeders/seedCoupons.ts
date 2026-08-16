import { couponSchema } from '@snapspare/shared'
import { SELLER_BLUEPRINTS } from '../data/sellers.js'
import { seedCollection } from '../lib/batch.js'
import { db } from '../lib/firebaseAdmin.js'

const DAY_MS = 86_400_000

export async function seedCoupons(): Promise<void> {
  const now = Date.now()

  const coupons = [
    couponSchema.parse({
      id: 'coupon-welcome10',
      code: 'WELCOME10',
      description: '10% off your first order, up to ₹200',
      discountType: 'percent',
      discountPercent: 10,
      maxDiscountPaise: 20000,
      minOrderValuePaise: 50000,
      usageLimitPerUser: 1,
      usedCount: 0,
      validFrom: now - 30 * DAY_MS,
      validUntil: now + 90 * DAY_MS,
      status: 'active',
      createdAt: now - 30 * DAY_MS,
      updatedAt: now - 30 * DAY_MS,
    }),
    couponSchema.parse({
      id: 'coupon-flat200',
      code: 'FLAT200',
      description: 'Flat ₹200 off orders above ₹1,500',
      discountType: 'flat',
      discountAmountPaise: 20000,
      minOrderValuePaise: 150000,
      usedCount: 12,
      validFrom: now - 20 * DAY_MS,
      validUntil: now + 60 * DAY_MS,
      status: 'active',
      createdAt: now - 20 * DAY_MS,
      updatedAt: now - 20 * DAY_MS,
    }),
    couponSchema.parse({
      id: 'coupon-bulk15',
      code: 'BULK15',
      description: '15% off engine and brake parts for bulk buyers',
      discountType: 'percent',
      discountPercent: 15,
      maxDiscountPaise: 100000,
      applicableCategorySlugs: ['engine', 'brake'],
      usageLimitPerUser: 2,
      usedCount: 5,
      validFrom: now - 10 * DAY_MS,
      validUntil: now + 45 * DAY_MS,
      status: 'active',
      createdAt: now - 10 * DAY_MS,
      updatedAt: now - 10 * DAY_MS,
    }),
    couponSchema.parse({
      id: 'coupon-festive20',
      code: 'FESTIVE20',
      description: 'Festive season sale — 20% off, up to ₹500',
      discountType: 'percent',
      discountPercent: 20,
      maxDiscountPaise: 50000,
      usageLimitTotal: 500,
      usedCount: 187,
      validFrom: now - 5 * DAY_MS,
      validUntil: now + 15 * DAY_MS,
      status: 'active',
      createdAt: now - 5 * DAY_MS,
      updatedAt: now - 5 * DAY_MS,
    }),
    couponSchema.parse({
      id: 'coupon-sellerspecial',
      code: 'AUTOZONE12',
      description: '12% off on AutoZone Traders listings',
      discountType: 'percent',
      discountPercent: 12,
      maxDiscountPaise: 30000,
      applicableSellerIds: [SELLER_BLUEPRINTS[0]!.id],
      usedCount: 3,
      validFrom: now - 15 * DAY_MS,
      validUntil: now + 30 * DAY_MS,
      status: 'active',
      createdAt: now - 15 * DAY_MS,
      updatedAt: now - 15 * DAY_MS,
    }),
    couponSchema.parse({
      id: 'coupon-summer50-expired',
      code: 'SUMMER50',
      description: 'Flat ₹50 off — summer sale (ended)',
      discountType: 'flat',
      discountAmountPaise: 5000,
      usedCount: 340,
      validFrom: now - 120 * DAY_MS,
      validUntil: now - 60 * DAY_MS,
      status: 'expired',
      createdAt: now - 120 * DAY_MS,
      updatedAt: now - 60 * DAY_MS,
    }),
    couponSchema.parse({
      id: 'coupon-newuser-inactive',
      code: 'NEWUSER100',
      description: 'Flat ₹100 off for new users (paused)',
      discountType: 'flat',
      discountAmountPaise: 10000,
      usageLimitPerUser: 1,
      usedCount: 0,
      validFrom: now,
      validUntil: now + 120 * DAY_MS,
      status: 'inactive',
      createdAt: now - 2 * DAY_MS,
      updatedAt: now - 1 * DAY_MS,
    }),
  ]

  await seedCollection(db.collection('coupons'), coupons)
  console.log(`  coupons: ${coupons.length}`)
}
