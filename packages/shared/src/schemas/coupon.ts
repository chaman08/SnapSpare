import { z } from 'zod'
import { makeFirestoreConverter } from '../firestore/converter'
import { couponIdSchema, sellerIdSchema } from '../ids'
import { epochMsSchema } from './common'

const couponBaseSchema = z.object({
  id: couponIdSchema,
  code: z.string().min(1),
  description: z.string().optional(),
  minOrderValuePaise: z.number().int().nonnegative().optional(),
  applicableCategorySlugs: z.array(z.string()).optional(),
  applicableSellerIds: z.array(sellerIdSchema).optional(),
  usageLimitTotal: z.number().int().positive().optional(),
  usageLimitPerUser: z.number().int().positive().optional(),
  usedCount: z.number().int().nonnegative().default(0),
  validFrom: epochMsSchema,
  validUntil: epochMsSchema,
  status: z.enum(['active', 'inactive', 'expired']),
  createdAt: epochMsSchema,
  updatedAt: epochMsSchema,
})

export const couponSchema = z.discriminatedUnion('discountType', [
  couponBaseSchema.extend({
    discountType: z.literal('percent'),
    discountPercent: z.number().min(1).max(100),
    maxDiscountPaise: z.number().int().positive().optional(),
  }),
  couponBaseSchema.extend({
    discountType: z.literal('flat'),
    discountAmountPaise: z.number().int().positive(),
  }),
])
export type Coupon = z.infer<typeof couponSchema>

export const couponConverter = makeFirestoreConverter(couponSchema)
