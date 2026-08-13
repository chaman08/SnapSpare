import { z } from 'zod'
import { makeFirestoreConverter } from '../firestore/converter'
import {
  garageVehicleIdSchema,
  userIdSchema,
  vehicleMakeIdSchema,
  vehicleModelIdSchema,
  vehicleVariantIdSchema,
} from '../ids'
import { epochMsSchema } from './common'
import { fuelTypeSchema } from './vehicleVariant'

/** A buyer's saved vehicle ("garage"), used to drive the persistent fitment bar. */
export const garageVehicleSchema = z.object({
  id: garageVehicleIdSchema,
  userId: userIdSchema,
  makeId: vehicleMakeIdSchema,
  makeName: z.string(),
  modelId: vehicleModelIdSchema,
  modelName: z.string(),
  variantId: vehicleVariantIdSchema,
  variantName: z.string(),
  // Denormalised off the selected variant at save time, purely so fitment
  // checks (checkFitment's VehicleSelection) don't need an extra read to
  // find a saved vehicle's fuel type.
  fuelType: fuelTypeSchema.optional(),
  registrationNumber: z.string().optional(),
  nickname: z.string().optional(),
  year: z.number().int().min(1980).max(2100).optional(),
  odometerKm: z.number().int().nonnegative().optional(),
  isPrimary: z.boolean().default(false),
  createdAt: epochMsSchema,
  updatedAt: epochMsSchema,
})
export type GarageVehicle = z.infer<typeof garageVehicleSchema>

export const garageVehicleConverter = makeFirestoreConverter(garageVehicleSchema)
