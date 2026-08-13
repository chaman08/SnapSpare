import { z } from 'zod'
import { vehicleClassSchema } from '../enums'
import { makeFirestoreConverter } from '../firestore/converter'
import { vehicleMakeIdSchema } from '../ids'
import { epochMsSchema } from './common'

export const vehicleMakeSchema = z.object({
  id: vehicleMakeIdSchema,
  name: z.string().min(1),
  slug: z.string().min(1),
  logoUrl: z.string().url().optional(),
  vehicleClass: vehicleClassSchema,
  status: z.enum(['active', 'inactive']),
  createdAt: epochMsSchema,
  updatedAt: epochMsSchema,
})
export type VehicleMake = z.infer<typeof vehicleMakeSchema>

export const vehicleMakeConverter = makeFirestoreConverter(vehicleMakeSchema)
