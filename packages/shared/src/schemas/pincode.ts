import { z } from 'zod'
import { makeFirestoreConverter } from '../firestore/converter'
import { pincodeSchema } from '../validators/indian'
import { epochMsSchema, stateCodeSchema } from './common'

/**
 * Master pincode -> city/state lookup table (document ID is the pincode
 * itself), populated from an external India Post dataset. Used by the
 * address book's pincode auto-fill.
 */
export const pincodeMasterSchema = z.object({
  id: pincodeSchema,
  city: z.string().min(1),
  state: z.string().min(1),
  stateCode: stateCodeSchema,
  createdAt: epochMsSchema,
  updatedAt: epochMsSchema,
})
export type PincodeMaster = z.infer<typeof pincodeMasterSchema>

export const pincodeMasterConverter = makeFirestoreConverter(pincodeMasterSchema)
