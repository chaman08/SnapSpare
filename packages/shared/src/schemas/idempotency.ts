import { z } from 'zod'
import { makeFirestoreConverter } from '../firestore/converter'
import { userIdSchema } from '../ids'
import { epochMsSchema } from './common'

export const idempotencyStatusSchema = z.enum(['in_progress', 'completed'])
export type IdempotencyStatus = z.infer<typeof idempotencyStatusSchema>

/**
 * One document per idempotency key, doc id == the key itself (see
 * functions/src/checkout/idempotency.ts). A retried callable with the same
 * key returns the cached `responseJson` instead of re-running side effects
 * (stock reservation, gateway order creation) a second time. Admin-SDK-only,
 * never read or written by the client directly.
 */
export const idempotencyRecordSchema = z.object({
  id: z.string().min(1),
  functionName: z.string().min(1),
  userId: userIdSchema.optional(),
  status: idempotencyStatusSchema,
  responseJson: z.string().optional(),
  createdAt: epochMsSchema,
  updatedAt: epochMsSchema,
  /** Records past this point are safe for a future cleanup job to delete — no cleanup job ships in this phase, see checkout README notes. */
  expiresAt: epochMsSchema,
})
export type IdempotencyRecord = z.infer<typeof idempotencyRecordSchema>

export const idempotencyRecordConverter = makeFirestoreConverter(idempotencyRecordSchema)
