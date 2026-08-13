import { z } from 'zod'
import { makeFirestoreConverter } from '../firestore/converter'
import { partIdSchema } from '../ids'
import { epochMsSchema } from './common'

/**
 * One doc per catalog part, id == partId. `boughtWith` is maintained by
 * functions/src/recommendation/onSubOrderDelivered.ts (incremented whenever
 * two parts appear together in a delivered subOrder) and drives "Frequently
 * bought together". `viewedWith` is maintained by the logPartCoView callable
 * (incremented whenever a buyer views this part right after another) and
 * drives "Others also viewed". Both are simple pairwise counters, not a
 * real recommendation model — good enough for an MVP rail, not a source of
 * truth for anything pricing- or inventory-related.
 */
export const coOccurrenceSchema = z.object({
  id: partIdSchema,
  boughtWith: z.record(z.string(), z.number().int().nonnegative()).default({}),
  viewedWith: z.record(z.string(), z.number().int().nonnegative()).default({}),
  updatedAt: epochMsSchema,
})
export type CoOccurrence = z.infer<typeof coOccurrenceSchema>

export const coOccurrenceConverter = makeFirestoreConverter(coOccurrenceSchema)
