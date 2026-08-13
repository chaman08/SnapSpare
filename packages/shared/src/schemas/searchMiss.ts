import { z } from 'zod'
import { makeFirestoreConverter } from '../firestore/converter'
import { userIdSchema, vehicleModelIdSchema } from '../ids'
import { epochMsSchema } from './common'

/**
 * One row per zero-result search — the seller-acquisition / catalogue-gap
 * list (see the search results page's empty state, which is the only writer
 * of this collection). Deliberately client-writable directly (no callable):
 * it must work for signed-out browsing too, and the payload is small and
 * fully attacker-inert (nothing here gates money, auth, or another user's
 * data) — see firestore.rules for the shape guard on the create rule.
 */
export const searchMissSchema = z.object({
  id: z.string().min(1),
  query: z.string().min(1).max(200),
  normalizedQuery: z.string().min(1).max(200),
  /** Facets active when the search still returned zero results, e.g. { fitsMyVehicle: true, brand: 'Bosch' } — helps tell "no catalogue for this" apart from "filtered too hard". */
  activeFilters: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
  vehicleModelId: vehicleModelIdSchema.optional(),
  categorySlug: z.string().optional(),
  userId: userIdSchema.optional(),
  createdAt: epochMsSchema,
})
export type SearchMiss = z.infer<typeof searchMissSchema>

export const searchMissConverter = makeFirestoreConverter(searchMissSchema)
