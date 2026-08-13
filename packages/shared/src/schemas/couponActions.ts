import { z } from 'zod'
import { couponIdSchema } from '../ids'
import { epochMsSchema } from './common'

/** Marketing module (design brief item 9) coupon builder. `id` absent means create. `status: 'inactive'` is how a coupon is "deleted" — coupons are referenced by past orders (couponCode), so a hard delete would break historical order records. */
export const saveCouponRequestSchema = z
  .object({
    id: couponIdSchema.optional(),
    code: z.string().min(1),
    description: z.string().optional(),
    discountType: z.enum(['percent', 'flat']),
    discountPercent: z.number().min(1).max(100).optional(),
    maxDiscountPaise: z.number().int().positive().optional(),
    discountAmountPaise: z.number().int().positive().optional(),
    minOrderValuePaise: z.number().int().nonnegative().optional(),
    applicableCategorySlugs: z.array(z.string()).optional(),
    applicableSellerIds: z.array(z.string()).optional(),
    usageLimitTotal: z.number().int().positive().optional(),
    usageLimitPerUser: z.number().int().positive().optional(),
    validFrom: epochMsSchema,
    validUntil: epochMsSchema,
    status: z.enum(['active', 'inactive', 'expired']).default('active'),
  })
  .superRefine((value, ctx) => {
    if (value.discountType === 'percent' && value.discountPercent === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['discountPercent'], message: 'discountPercent is required for a percent coupon' })
    }
    if (value.discountType === 'flat' && value.discountAmountPaise === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['discountAmountPaise'], message: 'discountAmountPaise is required for a flat coupon' })
    }
    if (value.validUntil <= value.validFrom) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['validUntil'], message: 'validUntil must be after validFrom' })
    }
  })
export type SaveCouponRequest = z.infer<typeof saveCouponRequestSchema>

export const saveCouponResultSchema = z.object({ id: couponIdSchema })
export type SaveCouponResult = z.infer<typeof saveCouponResultSchema>
