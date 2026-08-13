import { z } from 'zod'
import { makeFirestoreConverter } from '../firestore/converter'
import { creditLimitRequestIdSchema, userIdSchema } from '../ids'
import { paiseSchema } from '../types/money'
import { epochMsSchema } from './common'

export const creditLimitRequestStatusSchema = z.enum(['pending', 'approved', 'rejected'])
export type CreditLimitRequestStatus = z.infer<typeof creditLimitRequestStatusSchema>

/**
 * A verified garage's ask for a Khata credit limit (new account) or a raise
 * on an existing one — design brief item 7's "clear admin approval flow."
 * Buyer-created via requestCreditLimit.ts (garage-verified only), resolved
 * only by approveCreditLimit.ts (admin-only), which also writes the
 * corresponding creditLimitChanges entry.
 */
export const creditLimitRequestSchema = z.object({
  id: creditLimitRequestIdSchema,
  buyerId: userIdSchema,
  requestedLimitPaise: paiseSchema,
  reason: z.string().min(1).optional(),
  status: creditLimitRequestStatusSchema,
  reviewedBy: userIdSchema.optional(),
  reviewedAt: epochMsSchema.optional(),
  reviewNotes: z.string().optional(),
  createdAt: epochMsSchema,
  updatedAt: epochMsSchema,
})
export type CreditLimitRequest = z.infer<typeof creditLimitRequestSchema>

export const creditLimitRequestConverter = makeFirestoreConverter(creditLimitRequestSchema)
