import { z } from 'zod'
import { makeFirestoreConverter } from '../firestore/converter'
import { creditAccountIdSchema, userIdSchema } from '../ids'
import { epochMsSchema } from './common'

export const creditAccountSchema = z.object({
  id: creditAccountIdSchema,
  buyerId: userIdSchema,
  creditLimitPaise: z.number().int().nonnegative(),
  availableCreditPaise: z.number().int().nonnegative(),
  outstandingPaise: z.number().int().nonnegative(),
  dueDay: z.number().int().min(1).max(28).optional(),
  status: z.enum(['active', 'suspended', 'closed']),
  approvedBy: userIdSchema.optional(),
  approvedAt: epochMsSchema.optional(),
  createdAt: epochMsSchema,
  updatedAt: epochMsSchema,
})
export type CreditAccount = z.infer<typeof creditAccountSchema>

export const creditAccountConverter = makeFirestoreConverter(creditAccountSchema)
