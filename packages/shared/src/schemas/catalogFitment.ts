import { z } from 'zod'
import { makeFirestoreConverter } from '../firestore/converter'
import {
  catalogFitmentIdSchema,
  partIdSchema,
  userIdSchema,
  vehicleMakeIdSchema,
  vehicleModelIdSchema,
  vehicleVariantIdSchema,
} from '../ids'
import { epochMsSchema } from './common'
import { fuelTypeSchema } from './vehicleVariant'

/**
 * A verified compatibility record between a master catalog part and a
 * vehicle. `variantId` is optional — a fitment row may apply to every
 * variant of a model (e.g. a body panel that fits regardless of engine/trim);
 * when present, an exact variant match is required. Same idea for
 * `fuelTypes`: omitted means "any fuel", present means the vehicle's fuel
 * must be one of the listed types. See functions/src/fitment/checkFitment.ts
 * for the full matching algorithm.
 */
export const catalogFitmentSchema = z.object({
  id: catalogFitmentIdSchema,
  partId: partIdSchema,
  makeId: vehicleMakeIdSchema,
  modelId: vehicleModelIdSchema,
  variantId: vehicleVariantIdSchema.optional(),
  fuelTypes: z.array(fuelTypeSchema).min(1).optional(),
  yearFrom: z.number().int().min(1980).max(2100).optional(),
  yearTo: z.number().int().min(1980).max(2100).optional(),
  notes: z.string().optional(),
  verifiedBy: userIdSchema.optional(),
  verifiedAt: epochMsSchema.optional(),
  createdAt: epochMsSchema,
  updatedAt: epochMsSchema,
})
export type CatalogFitment = z.infer<typeof catalogFitmentSchema>

export const catalogFitmentConverter = makeFirestoreConverter(catalogFitmentSchema)
