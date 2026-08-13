import { z } from 'zod'
import { makeFirestoreConverter } from '../firestore/converter'
import { addressIdSchema, userIdSchema } from '../ids'
import { gstinSchema, mobileSchema, pincodeSchema } from '../validators/indian'
import { epochMsSchema, stateCodeSchema } from './common'

export const addressSchema = z.object({
  id: addressIdSchema,
  userId: userIdSchema,
  label: z.string().min(1),
  contactName: z.string().min(1),
  contactPhone: mobileSchema,
  line1: z.string().min(1),
  line2: z.string().optional(),
  landmark: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(1),
  stateCode: stateCodeSchema,
  pincode: pincodeSchema,
  gstin: gstinSchema.optional(),
  isDefault: z.boolean().default(false),
  geo: z.object({ lat: z.number(), lng: z.number() }).optional(),
  createdAt: epochMsSchema,
  updatedAt: epochMsSchema,
})
export type Address = z.infer<typeof addressSchema>

export const addressConverter = makeFirestoreConverter(addressSchema)
