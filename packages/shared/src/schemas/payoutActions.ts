import { z } from 'zod'
import { payoutIdSchema } from '../ids'

export const getPayoutStatementRequestSchema = z.object({
  payoutId: payoutIdSchema,
})
export type GetPayoutStatementRequest = z.infer<typeof getPayoutStatementRequestSchema>

export const getPayoutStatementResultSchema = z.object({
  csv: z.string(),
  rowCount: z.number().int().nonnegative(),
})
export type GetPayoutStatementResult = z.infer<typeof getPayoutStatementResultSchema>
