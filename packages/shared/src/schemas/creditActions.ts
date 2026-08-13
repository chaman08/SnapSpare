import { z } from 'zod'
import { creditAccountIdSchema, creditLimitRequestIdSchema, userIdSchema } from '../ids'
import { paiseSchema } from '../types/money'

export const requestCreditLimitRequestSchema = z.object({
  requestedLimitPaise: paiseSchema,
  reason: z.string().min(1).max(500).optional(),
})
export type RequestCreditLimitRequest = z.infer<typeof requestCreditLimitRequestSchema>

export const requestCreditLimitResultSchema = z.object({
  creditLimitRequestId: creditLimitRequestIdSchema,
})
export type RequestCreditLimitResult = z.infer<typeof requestCreditLimitResultSchema>

export const approveCreditLimitRequestSchema = z.object({
  creditLimitRequestId: creditLimitRequestIdSchema.optional(),
  buyerId: userIdSchema,
  approved: z.boolean(),
  /** Required when `approved`; the new limit to set (creates the account on first approval). Ignored when `approved` is false. */
  newLimitPaise: paiseSchema.optional(),
  reviewNotes: z.string().max(500).optional(),
})
export type ApproveCreditLimitRequest = z.infer<typeof approveCreditLimitRequestSchema>

export const approveCreditLimitResultSchema = z.object({
  creditAccountId: creditAccountIdSchema.optional(),
})
export type ApproveCreditLimitResult = z.infer<typeof approveCreditLimitResultSchema>

export const createCreditRepaymentLinkRequestSchema = z.object({
  amountPaise: paiseSchema,
})
export type CreateCreditRepaymentLinkRequest = z.infer<typeof createCreditRepaymentLinkRequestSchema>

export const createCreditRepaymentLinkResultSchema = z.object({
  shortUrl: z.string().url(),
})
export type CreateCreditRepaymentLinkResult = z.infer<typeof createCreditRepaymentLinkResultSchema>
