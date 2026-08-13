import { z } from 'zod'
import { returnReasonSchema, subOrderStatusSchema } from '../enums'
import { returnIdSchema, subOrderIdSchema } from '../ids'
import { returnQcOutcomeSchema, returnResolutionPreferenceSchema, returnStatusSchema } from './return'

// ---------------------------------------------------------------------------
// acceptSubOrder / rejectSubOrder / packSubOrder / cancelSubOrder
// ---------------------------------------------------------------------------

export const subOrderIdRequestSchema = z.object({
  subOrderId: subOrderIdSchema,
})
export type SubOrderIdRequest = z.infer<typeof subOrderIdRequestSchema>

export const cancelSubOrderRequestSchema = z.object({
  subOrderId: subOrderIdSchema,
  reason: z.string().min(1).max(500).optional(),
})
export type CancelSubOrderRequest = z.infer<typeof cancelSubOrderRequestSchema>

export const subOrderActionResultSchema = z.object({
  subOrderId: subOrderIdSchema,
  status: subOrderStatusSchema,
})
export type SubOrderActionResult = z.infer<typeof subOrderActionResultSchema>

// ---------------------------------------------------------------------------
// shipSubOrder
// ---------------------------------------------------------------------------

export const shipSubOrderRequestSchema = z.object({
  subOrderId: subOrderIdSchema,
  awb: z.string().min(1).max(64),
  courier: z.string().min(1).max(64),
})
export type ShipSubOrderRequest = z.infer<typeof shipSubOrderRequestSchema>

// ---------------------------------------------------------------------------
// updateShipmentStatus — stand-in for the future Shiprocket tracking webhook
// (Phase 16-adjacent); for now callable by the owning seller or an admin.
// ---------------------------------------------------------------------------

export const updateShipmentStatusRequestSchema = z.object({
  subOrderId: subOrderIdSchema,
  status: z.enum(['out_for_delivery', 'delivered']),
})
export type UpdateShipmentStatusRequest = z.infer<typeof updateShipmentStatusRequestSchema>

// ---------------------------------------------------------------------------
// bulkAcceptSubOrders — seller order-queue "Accept all new"
// ---------------------------------------------------------------------------

export const bulkAcceptSubOrdersRequestSchema = z.object({
  subOrderIds: z.array(subOrderIdSchema).min(1).max(50),
})
export type BulkAcceptSubOrdersRequest = z.infer<typeof bulkAcceptSubOrdersRequestSchema>

export const bulkAcceptSubOrdersResultSchema = z.object({
  accepted: z.array(subOrderIdSchema),
  failed: z.array(z.object({ subOrderId: subOrderIdSchema, reason: z.string() })),
})
export type BulkAcceptSubOrdersResult = z.infer<typeof bulkAcceptSubOrdersResultSchema>

// ---------------------------------------------------------------------------
// requestReturn / refundReturn
// ---------------------------------------------------------------------------

export const requestReturnRequestSchema = z.object({
  subOrderId: subOrderIdSchema,
  /** Listing (line item) within the subOrder being returned. */
  listingId: z.string().min(1),
  qty: z.number().int().positive(),
  reason: returnReasonSchema,
  reasonNotes: z.string().max(1000).optional(),
  /** Storage paths (not public URLs) — client uploads to users/{uid}/returns/** first, then passes the resulting paths here. */
  images: z.array(z.string().min(1)).max(6).default([]),
  videoPath: z.string().min(1).optional(),
  resolutionPreference: returnResolutionPreferenceSchema,
})
export type RequestReturnRequest = z.infer<typeof requestReturnRequestSchema>

export const requestReturnResultSchema = z.object({
  returnId: returnIdSchema,
})
export type RequestReturnResult = z.infer<typeof requestReturnResultSchema>

export const refundReturnRequestSchema = z.object({
  returnId: returnIdSchema,
})
export type RefundReturnRequest = z.infer<typeof refundReturnRequestSchema>

export const refundReturnResultSchema = z.object({
  returnId: returnIdSchema,
  refundAmountPaise: z.number().int().nonnegative(),
})
export type RefundReturnResult = z.infer<typeof refundReturnResultSchema>

// ---------------------------------------------------------------------------
// decideReturn — seller/admin approve (books reverse pickup) or reject
// ---------------------------------------------------------------------------

export const decideReturnRequestSchema = z.object({
  returnId: returnIdSchema,
  decision: z.enum(['approved', 'rejected']),
  note: z.string().max(1000).optional(),
})
export type DecideReturnRequest = z.infer<typeof decideReturnRequestSchema>

export const decideReturnResultSchema = z.object({
  returnId: returnIdSchema,
  status: returnStatusSchema,
})
export type DecideReturnResult = z.infer<typeof decideReturnResultSchema>

// ---------------------------------------------------------------------------
// submitReturnQc — seller/admin records QC outcome on a received return
// ---------------------------------------------------------------------------

export const submitReturnQcRequestSchema = z.object({
  returnId: returnIdSchema,
  outcome: returnQcOutcomeSchema,
  photos: z.array(z.string().min(1)).min(1),
  note: z.string().max(1000).optional(),
})
export type SubmitReturnQcRequest = z.infer<typeof submitReturnQcRequestSchema>

export const submitReturnQcResultSchema = z.object({
  returnId: returnIdSchema,
  status: returnStatusSchema,
})
export type SubmitReturnQcResult = z.infer<typeof submitReturnQcResultSchema>
