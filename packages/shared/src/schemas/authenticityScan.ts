import { z } from 'zod'
import { makeFirestoreConverter } from '../firestore/converter'
import { authenticityScanIdSchema, listingIdSchema, userIdSchema } from '../ids'
import { epochMsSchema } from './common'

/**
 * Audit log for every QR/hologram scan submitted through
 * functions/src/trust/verifyPartAuthenticity.ts — low-volume until a real
 * brand-registry provider exists (see authenticityProvider.ts), so this has
 * no dedicated admin queue screen yet, just the raw collection.
 */
export const authenticityScanSchema = z.object({
  id: authenticityScanIdSchema,
  scannedBy: userIdSchema,
  code: z.string().min(1),
  listingId: listingIdSchema.optional(),
  valid: z.boolean(),
  brand: z.string().optional(),
  message: z.string().optional(),
  createdAt: epochMsSchema,
})
export type AuthenticityScan = z.infer<typeof authenticityScanSchema>

export const authenticityScanConverter = makeFirestoreConverter(authenticityScanSchema)

export const verifyPartAuthenticityRequestSchema = z.object({
  code: z.string().min(1),
  listingId: listingIdSchema.optional(),
})
export type VerifyPartAuthenticityRequest = z.infer<typeof verifyPartAuthenticityRequestSchema>

export const verifyPartAuthenticityResultSchema = z.object({
  valid: z.boolean(),
  brand: z.string().optional(),
  message: z.string().optional(),
})
export type VerifyPartAuthenticityResult = z.infer<typeof verifyPartAuthenticityResultSchema>
