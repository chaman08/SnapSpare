import { z } from 'zod'

/** State of the persistent fitment bar shown on catalog and PDP screens. */
export const fitmentStatusSchema = z.enum(['fits', 'does_not_fit', 'unverified'])

export type FitmentStatus = z.infer<typeof fitmentStatusSchema>
