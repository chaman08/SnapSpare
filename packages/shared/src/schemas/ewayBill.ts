import { z } from 'zod'
import { makeFirestoreConverter } from '../firestore/converter'
import { ewayBillTaskIdSchema, invoiceIdSchema, orderIdSchema, sellerIdSchema, subOrderIdSchema, userIdSchema } from '../ids'
import { gstinSchema, hsnSchema, pincodeSchema } from '../validators/indian'
import { epochMsSchema, stateCodeSchema } from './common'

/**
 * `pending`: consignment value crossed the threshold, no e-way bill filed
 * yet — surfaced as a to-do in the seller console. `generated`: seller (or
 * admin) recorded the e-way bill number they obtained from the GST portal
 * (or a future direct NIC/GSP integration — see functions/src/tax/ewayBill/
 * provider.ts). `not_required`: below threshold, task exists only because
 * it was evaluated (kept for audit trail rather than never writing one).
 */
export const ewayBillTaskStatusSchema = z.enum(['pending', 'generated', 'not_required'])
export type EwayBillTaskStatus = z.infer<typeof ewayBillTaskStatusSchema>

/**
 * One line of the e-way bill "item list" — field names/shapes deliberately
 * mirror the NIC e-way bill JSON schema (EWB_INV01) so a future direct
 * API/GSP integration can pass this straight through.
 */
export const ewayBillItemSchema = z.object({
  productName: z.string().min(1),
  hsnCode: hsnSchema,
  quantity: z.number().positive(),
  qtyUnit: z.string().min(1).default('NOS'),
  taxableAmount: z.number().nonnegative(),
  cgstRate: z.number().nonnegative(),
  sgstRate: z.number().nonnegative(),
  igstRate: z.number().nonnegative(),
})
export type EwayBillItem = z.infer<typeof ewayBillItemSchema>

/**
 * The exportable JSON payload a seller/admin can download and upload
 * directly into the GST e-way bill portal's bulk-JSON tool, or hand to a
 * GSP integration later — see functions/src/tax/ewayBill/provider.ts's
 * adapter interface. Field names again mirror the NIC schema.
 */
export const ewayBillPayloadSchema = z.object({
  supplyType: z.literal('O'), // Outward
  subSupplyType: z.literal('1'), // Supply
  docType: z.literal('INV'),
  docNo: z.string().min(1),
  docDate: z.string().min(1), // DD/MM/YYYY, NIC's expected format
  fromGstin: gstinSchema,
  fromTrdName: z.string().min(1),
  fromAddr1: z.string().min(1),
  fromPlace: z.string().min(1),
  fromPincode: pincodeSchema,
  fromStateCode: stateCodeSchema,
  toGstin: gstinSchema.optional(),
  toTrdName: z.string().min(1),
  toAddr1: z.string().min(1),
  toPlace: z.string().min(1),
  toPincode: pincodeSchema,
  toStateCode: stateCodeSchema,
  transactionType: z.literal(1), // Regular (single from/to)
  totalValue: z.number().nonnegative(),
  cgstValue: z.number().nonnegative(),
  sgstValue: z.number().nonnegative(),
  igstValue: z.number().nonnegative(),
  totInvValue: z.number().nonnegative(),
  itemList: z.array(ewayBillItemSchema).min(1),
})
export type EwayBillPayload = z.infer<typeof ewayBillPayloadSchema>

export const ewayBillTaskSchema = z.object({
  id: ewayBillTaskIdSchema,
  orderId: orderIdSchema,
  subOrderId: subOrderIdSchema,
  invoiceId: invoiceIdSchema,
  sellerId: sellerIdSchema,
  buyerId: userIdSchema,
  consignmentValuePaise: z.number().int().nonnegative(),
  status: ewayBillTaskStatusSchema,
  ewayBillNumber: z.string().optional(),
  ewayBillGeneratedAt: epochMsSchema.optional(),
  payload: ewayBillPayloadSchema,
  createdAt: epochMsSchema,
  updatedAt: epochMsSchema,
})
export type EwayBillTask = z.infer<typeof ewayBillTaskSchema>
export const ewayBillTaskConverter = makeFirestoreConverter(ewayBillTaskSchema)

// ---------------------------------------------------------------------------
// markEwayBillGenerated callable — seller/admin records the number they
// obtained by manually filing the exported payload on the GST portal.
// ---------------------------------------------------------------------------

export const markEwayBillGeneratedRequestSchema = z.object({
  ewayBillTaskId: ewayBillTaskIdSchema,
  ewayBillNumber: z.string().min(1).max(32),
})
export type MarkEwayBillGeneratedRequest = z.infer<typeof markEwayBillGeneratedRequestSchema>

export const markEwayBillGeneratedResultSchema = z.object({
  ewayBillTaskId: ewayBillTaskIdSchema,
  status: ewayBillTaskStatusSchema,
})
export type MarkEwayBillGeneratedResult = z.infer<typeof markEwayBillGeneratedResultSchema>
