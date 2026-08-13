import { z } from 'zod'
import { gstinSchema, mobileSchema, pincodeSchema } from '../validators/indian'
import { INDIAN_STATE_CODE_LIST } from '../constants/states'

/**
 * Timestamps are stored as epoch milliseconds rather than a Firestore
 * Timestamp type, so this package doesn't need to depend on either the
 * client or admin Firestore SDK, and so the same value round-trips cleanly
 * through Typesense/JSON without conversion.
 */
export const epochMsSchema = z.number().int().nonnegative()
export type EpochMs = z.infer<typeof epochMsSchema>

export const stateCodeSchema = z.enum(
  INDIAN_STATE_CODE_LIST as [string, ...string[]],
)

/**
 * Wraps an `onCall` request schema so it tolerates the callable SDK's own
 * wire format: `firebase/functions`' `httpsCallable` serializes a field the
 * caller left `undefined` (i.e. genuinely omitted, the normal shape for an
 * optional field) as JSON `null` — there's no "absent key" on the wire —
 * so it arrives server-side as `null`, which a plain `z.optional()` field
 * rejects (it only accepts `undefined`). This strips top-level `null`
 * values back to "absent" before the real schema runs, so `.optional()`
 * fields work as callers actually expect. Shallow only: a legitimately
 * nullable *nested* field (e.g. `pricingTierSchema.maxQty: null`, meaning
 * "open-ended", not "omitted") is left untouched since it's never a
 * top-level key.
 */
export function callableRequestSchema<Schema extends z.ZodTypeAny>(schema: Schema) {
  return z.preprocess((value) => {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return value
    const stripped: Record<string, unknown> = {}
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== null) stripped[key] = v
    }
    return stripped
  }, schema)
}

/**
 * A point-in-time copy of an address, embedded on orders/sub-orders so that
 * later edits to the buyer's saved address never change historical invoices.
 */
export const addressSnapshotSchema = z.object({
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
})
export type AddressSnapshot = z.infer<typeof addressSnapshotSchema>
