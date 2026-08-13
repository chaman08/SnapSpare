import { z } from 'zod'
import { fitmentStatusSchema } from '../types/fitment'
import { partIdSchema, vehicleMakeIdSchema, vehicleModelIdSchema, vehicleVariantIdSchema } from '../ids'
import { catalogFitmentSchema } from './catalogFitment'
import { fuelTypeSchema } from './vehicleVariant'

/**
 * The minimal vehicle shape the `checkFitment` callable needs to run its
 * matching algorithm — a flattened, denormalised snapshot of a garage
 * vehicle (or an in-progress VehicleSelector pick), not a Firestore
 * reference. `fuelType` is optional purely for forward-compatibility; every
 * real caller today sources it from the selected variant, which always has one.
 */
export const vehicleSelectionSchema = z.object({
  makeId: vehicleMakeIdSchema,
  modelId: vehicleModelIdSchema,
  variantId: vehicleVariantIdSchema,
  year: z.number().int().min(1980).max(2100),
  fuelType: fuelTypeSchema.optional(),
})
export type VehicleSelection = z.infer<typeof vehicleSelectionSchema>

export const checkFitmentRequestSchema = z.object({
  partId: partIdSchema,
  vehicle: vehicleSelectionSchema,
})
export type CheckFitmentRequest = z.infer<typeof checkFitmentRequestSchema>

export const checkFitmentResultSchema = z.object({
  status: fitmentStatusSchema,
  fitment: catalogFitmentSchema.optional(),
})
export type CheckFitmentResult = z.infer<typeof checkFitmentResultSchema>
