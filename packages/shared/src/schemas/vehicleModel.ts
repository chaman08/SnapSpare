import { z } from 'zod'
import { vehicleClassSchema } from '../enums'
import { makeFirestoreConverter } from '../firestore/converter'
import { vehicleMakeIdSchema, vehicleModelIdSchema } from '../ids'
import { epochMsSchema } from './common'

export const vehicleModelSchema = z.object({
  id: vehicleModelIdSchema,
  makeId: vehicleMakeIdSchema,
  name: z.string().min(1),
  slug: z.string().min(1),
  vehicleClass: vehicleClassSchema,
  generation: z.string().optional(),
  yearFrom: z.number().int().min(1980).max(2100),
  yearTo: z.number().int().min(1980).max(2100).optional(),
  status: z.enum(['active', 'inactive']),
  createdAt: epochMsSchema,
  updatedAt: epochMsSchema,
})
export type VehicleModel = z.infer<typeof vehicleModelSchema>

export const vehicleModelConverter = makeFirestoreConverter(vehicleModelSchema)
