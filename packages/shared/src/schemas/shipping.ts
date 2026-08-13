import { z } from 'zod'
import { makeFirestoreConverter } from '../firestore/converter'
import { sellerIdSchema, subOrderIdSchema } from '../ids'
import { paiseSchema } from '../types/money'
import { pincodeSchema } from '../validators/indian'
import { epochMsSchema } from './common'

// ---------------------------------------------------------------------------
// Provider adapter
// ---------------------------------------------------------------------------

export const shippingProviderNameSchema = z.enum(['mock', 'shiprocket'])
export type ShippingProviderName = z.infer<typeof shippingProviderNameSchema>

export const dimensionsCmSchema = z.object({
  lengthCm: z.number().positive(),
  widthCm: z.number().positive(),
  heightCm: z.number().positive(),
})
export type DimensionsCm = z.infer<typeof dimensionsCmSchema>

// ---------------------------------------------------------------------------
// config/shipping — admin-tunable zone matrix, weight slabs, oversized rules
// ---------------------------------------------------------------------------

export const shippingZoneRateSchema = z.object({
  baseFarePaise: paiseSchema,
  perKgPaise: paiseSchema,
  etaDaysMin: z.number().int().positive(),
  etaDaysMax: z.number().int().positive(),
})
export type ShippingZoneRate = z.infer<typeof shippingZoneRateSchema>

/**
 * All four zones required, not `z.record` — a `z.record(shippingZoneSchema, ...)`
 * types every value as possibly-`undefined` (zod can't statically prove a
 * record covers every enum key), which doesn't structurally satisfy
 * pricing/shipping.ts's `ShippingRateConfig.zones` (a full, always-present
 * `Record<ShippingZone, ...>`) — `estimateSellerShipping` indexes it
 * directly with no fallback.
 */
export const shippingZonesConfigSchema = z.object({
  zone_local: shippingZoneRateSchema,
  zone_regional: shippingZoneRateSchema,
  zone_national: shippingZoneRateSchema,
  zone_remote: shippingZoneRateSchema,
})

export const shippingConfigSchema = z.object({
  id: z.string().min(1),
  zones: shippingZonesConfigSchema,
  freeShippingThresholdPaise: paiseSchema,
  oversizedEtaExtraDays: z.number().int().nonnegative(),
  oversizedCodRestricted: z.boolean(),
  volumetricDivisorCm3PerKg: z.number().int().positive(),
  updatedAt: epochMsSchema,
})
export type ShippingConfig = z.infer<typeof shippingConfigSchema>

export const shippingConfigConverter = makeFirestoreConverter(shippingConfigSchema)

// ---------------------------------------------------------------------------
// getShippingRates — serviceability + live courier rate check, cached
// ---------------------------------------------------------------------------

export const getShippingRatesRequestSchema = z.object({
  sellerId: sellerIdSchema,
  destPincode: pincodeSchema,
  weightGrams: z.number().int().positive(),
  dimensionsCm: dimensionsCmSchema.optional(),
  codAmountPaise: paiseSchema.optional(),
})
export type GetShippingRatesRequest = z.infer<typeof getShippingRatesRequestSchema>

export const rateQuoteSchema = z.object({
  courier: z.string().min(1),
  ratePaise: paiseSchema,
  etaDaysMin: z.number().int().positive(),
  etaDaysMax: z.number().int().positive(),
  codAvailable: z.boolean(),
})
export type RateQuote = z.infer<typeof rateQuoteSchema>

export const getShippingRatesResultSchema = z.object({
  serviceable: z.boolean(),
  quotes: z.array(rateQuoteSchema),
})
export type GetShippingRatesResult = z.infer<typeof getShippingRatesResultSchema>

// ---------------------------------------------------------------------------
// bookShipment / schedulePickup / generateShippingLabel / cancelShipment
// ---------------------------------------------------------------------------

export const bookShipmentRequestSchema = z.object({
  subOrderId: subOrderIdSchema,
})
export type BookShipmentRequest = z.infer<typeof bookShipmentRequestSchema>

export const bookShipmentResultSchema = z.object({
  subOrderId: subOrderIdSchema,
  providerShipmentId: z.string(),
  providerOrderId: z.string(),
  awb: z.string().optional(),
  courier: z.string().optional(),
})
export type BookShipmentResult = z.infer<typeof bookShipmentResultSchema>

/** YYYY-MM-DD, the grain Shiprocket's pickup-generation API expects. */
export const pickupDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const schedulePickupRequestSchema = z.object({
  subOrderId: subOrderIdSchema,
  pickupDate: pickupDateSchema,
})
export type SchedulePickupRequest = z.infer<typeof schedulePickupRequestSchema>

export const schedulePickupResultSchema = z.object({
  subOrderId: subOrderIdSchema,
  pickupScheduledAt: epochMsSchema,
  pickupDate: pickupDateSchema,
})
export type SchedulePickupResult = z.infer<typeof schedulePickupResultSchema>

export const generateShippingLabelRequestSchema = z.object({
  subOrderId: subOrderIdSchema,
})
export type GenerateShippingLabelRequest = z.infer<typeof generateShippingLabelRequestSchema>

export const generateShippingLabelResultSchema = z.object({
  subOrderId: subOrderIdSchema,
  labelUrl: z.string().url(),
})
export type GenerateShippingLabelResult = z.infer<typeof generateShippingLabelResultSchema>

export const cancelShipmentRequestSchema = z.object({
  subOrderId: subOrderIdSchema,
})
export type CancelShipmentRequest = z.infer<typeof cancelShipmentRequestSchema>

// ---------------------------------------------------------------------------
// NDR (non-delivery report) + RTO
// ---------------------------------------------------------------------------

export const ndrStatusSchema = z.enum(['raised', 'reattempt_requested', 'rto_initiated', 'resolved'])
export type NdrStatus = z.infer<typeof ndrStatusSchema>

/**
 * Lives at `subOrder.shipment.ndr` (see schemas/subOrder.ts) rather than its
 * own collection — it's one small piece of state on an already-tracked
 * shipment, not an independently queried entity. Raised by
 * functions/src/shipping/applyTrackingUpdate.ts when the courier reports an
 * undelivered attempt; cleared (well, left at `resolved`) once the parcel is
 * either redelivered or RTO-refunded.
 */
export const ndrInfoSchema = z.object({
  status: ndrStatusSchema,
  reasonCode: z.string().min(1),
  reasonText: z.string().optional(),
  attempts: z.number().int().positive().default(1),
  raisedAt: epochMsSchema,
  reattemptRequestedAt: epochMsSchema.optional(),
})
export type NdrInfo = z.infer<typeof ndrInfoSchema>

export const requestNdrReattemptRequestSchema = z.object({
  subOrderId: subOrderIdSchema,
  note: z.string().max(500).optional(),
})
export type RequestNdrReattemptRequest = z.infer<typeof requestNdrReattemptRequestSchema>

export const requestNdrReattemptResultSchema = z.object({
  subOrderId: subOrderIdSchema,
  ndrStatus: ndrStatusSchema,
})
export type RequestNdrReattemptResult = z.infer<typeof requestNdrReattemptResultSchema>
