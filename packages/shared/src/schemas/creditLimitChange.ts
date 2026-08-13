import { z } from 'zod'
import { makeFirestoreConverter } from '../firestore/converter'
import { creditAccountIdSchema, creditLimitChangeIdSchema, userIdSchema } from '../ids'
import { paiseSchema } from '../types/money'
import { epochMsSchema } from './common'

/**
 * Append-only audit log at `creditAccounts/{creditAccountId}/limitChanges/{id}`
 * — every change to a buyer's Khata credit limit, however it happened
 * (initial admin approval, a later increase/decrease, a suspension). Design
 * brief item 7: "log every limit change." Never client-writable.
 */
export const creditLimitChangeSchema = z.object({
  id: creditLimitChangeIdSchema,
  creditAccountId: creditAccountIdSchema,
  changedBy: userIdSchema,
  previousLimitPaise: paiseSchema,
  newLimitPaise: paiseSchema,
  reason: z.string().min(1).optional(),
  createdAt: epochMsSchema,
})
export type CreditLimitChange = z.infer<typeof creditLimitChangeSchema>

export const creditLimitChangeConverter = makeFirestoreConverter(creditLimitChangeSchema)
