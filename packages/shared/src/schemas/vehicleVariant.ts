import { z } from 'zod'
import { makeFirestoreConverter } from '../firestore/converter'
import { vehicleMakeIdSchema, vehicleModelIdSchema, vehicleVariantIdSchema } from '../ids'
import { epochMsSchema } from './common'

export const fuelTypeSchema = z.enum(['petrol', 'diesel', 'cng', 'electric', 'hybrid'])
export type FuelType = z.infer<typeof fuelTypeSchema>

export const transmissionSchema = z.enum(['manual', 'automatic', 'amt', 'cvt'])
export type Transmission = z.infer<typeof transmissionSchema>

export const vehicleVariantSchema = z.object({
  id: vehicleVariantIdSchema,
  makeId: vehicleMakeIdSchema,
  modelId: vehicleModelIdSchema,
  name: z.string().min(1),
  slug: z.string().min(1),
  fuelType: fuelTypeSchema,
  transmission: transmissionSchema,
  engineCc: z.number().int().positive().optional(),
  yearFrom: z.number().int().min(1980).max(2100),
  yearTo: z.number().int().min(1980).max(2100).optional(),
  status: z.enum(['active', 'inactive']),
  createdAt: epochMsSchema,
  updatedAt: epochMsSchema,
})
export type VehicleVariant = z.infer<typeof vehicleVariantSchema>

export const vehicleVariantConverter = makeFirestoreConverter(vehicleVariantSchema)
