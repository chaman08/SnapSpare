import { z } from 'zod'
import { makeFirestoreConverter } from '../firestore/converter'
import { payoutIdSchema, sellerIdSchema } from '../ids'
import { epochMsSchema } from './common'

export const payoutStatusSchema = z.enum(['pending', 'processing', 'paid', 'failed'])
export type PayoutStatus = z.infer<typeof payoutStatusSchema>

export const payoutSchema = z.object({
  id: payoutIdSchema,
  sellerId: sellerIdSchema,
  periodFrom: epochMsSchema,
  periodTo: epochMsSchema,
  grossAmountPaise: z.number().int().nonnegative(),
  commissionPaise: z.number().int().nonnegative(),
  tcsPaise: z.number().int().nonnegative().default(0),
  tdsPaise: z.number().int().nonnegative(),
  adjustmentsPaise: z.number().int().nonnegative(),
  netAmountPaise: z.number().int().nonnegative(),
  status: payoutStatusSchema,
  /** subOrderIds aggregated into this payout — see functions/src/payments/runSellerPayouts.ts and getPayoutStatement.ts (which re-derives the per-order breakdown from these ids). */
  subOrderIds: z.array(z.string().min(1)).default([]),
  utrNumber: z.string().optional(),
  failureReason: z.string().optional(),
  paidAt: epochMsSchema.optional(),
  createdAt: epochMsSchema,
  updatedAt: epochMsSchema,
})
export type Payout = z.infer<typeof payoutSchema>

export const payoutConverter = makeFirestoreConverter(payoutSchema)
