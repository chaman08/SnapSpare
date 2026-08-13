import { z } from 'zod'
import { vehicleMakeIdSchema, vehicleModelIdSchema, vehicleVariantIdSchema } from '../ids'
import { vehicleRegistrationSchema } from '../validators/indian'
import { fuelTypeSchema } from './vehicleVariant'

export const lookupVehicleByRegRequestSchema = z.object({
  regNumber: vehicleRegistrationSchema,
})
export type LookupVehicleByRegRequest = z.infer<typeof lookupVehicleByRegRequestSchema>

/**
 * Result of resolving a registration number to a vehicle. All vehicle fields
 * are optional and `confidence` may be `'low'` — this is a best-effort guess
 * that the UI must present as editable/confirmable, never auto-saved as-is.
 * See functions/src/vehicle/regLookupProvider.ts for why (no licensed data
 * provider is wired up yet — this ships with a mock).
 */
export const vehicleRegLookupResultSchema = z.object({
  regNumber: z.string(),
  found: z.boolean(),
  makeId: vehicleMakeIdSchema.optional(),
  makeName: z.string().optional(),
  modelId: vehicleModelIdSchema.optional(),
  modelName: z.string().optional(),
  variantId: vehicleVariantIdSchema.optional(),
  variantName: z.string().optional(),
  year: z.number().int().optional(),
  fuelType: fuelTypeSchema.optional(),
  confidence: z.enum(['high', 'medium', 'low']),
  source: z.enum(['mock', 'provider']),
})
export type VehicleRegLookupResult = z.infer<typeof vehicleRegLookupResultSchema>
