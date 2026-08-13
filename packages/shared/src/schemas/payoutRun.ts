import { z } from 'zod'
import { makeFirestoreConverter } from '../firestore/converter'
import { userIdSchema } from '../ids'
import { epochMsSchema } from './common'

export const triggerPayoutRunRequestSchema = z.object({}).default({})
export type TriggerPayoutRunRequest = z.infer<typeof triggerPayoutRunRequestSchema>

export const triggerPayoutRunResultSchema = z.object({
  payoutRunId: z.string().min(1),
  sellersProcessed: z.number().int().nonnegative(),
})
export type TriggerPayoutRunResult = z.infer<typeof triggerPayoutRunResultSchema>

/** Record of a manually-triggered payout run (Finance module) — the scheduled `runSellerPayouts` doesn't write one of these, only this admin-initiated path does, since the schedule's own logs already cover its runs. */
export const payoutRunIdSchema = z.string().min(1)
export const payoutRunSchema = z.object({
  id: payoutRunIdSchema,
  triggeredBy: userIdSchema,
  sellersProcessed: z.number().int().nonnegative(),
  periodTo: epochMsSchema,
  createdAt: epochMsSchema,
})
export type PayoutRun = z.infer<typeof payoutRunSchema>

export const payoutRunConverter = makeFirestoreConverter(payoutRunSchema)
