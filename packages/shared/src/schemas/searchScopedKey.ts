import { z } from 'zod'
import { epochMsSchema } from './common'

/** Response of the `createSearchKey` callable (functions/src/search/createSearchKey.ts). */
export const createSearchKeyResponseSchema = z.object({
  searchOnlyApiKey: z.string().min(1),
  host: z.string().min(1),
  port: z.number().int().positive(),
  protocol: z.enum(['http', 'https']),
  collectionName: z.string().min(1),
  expiresAt: epochMsSchema,
})
export type CreateSearchKeyResponse = z.infer<typeof createSearchKeyResponseSchema>
