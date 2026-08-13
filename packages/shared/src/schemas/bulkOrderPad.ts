import { z } from 'zod'
import { listingIdSchema, partIdSchema, sellerIdSchema } from '../ids'
import { paiseSchema } from '../types/money'

/** One parsed row from the pasted-text or CSV bulk order pad, before server resolution. */
export const bulkOrderPadRowInputSchema = z.object({
  /** Original line text, echoed back on unmatched rows so the buyer can see exactly what didn't resolve. */
  raw: z.string().min(1),
  /** Part number / SKU / OEM number the buyer typed or pasted. */
  query: z.string().min(1),
  qty: z.number().int().positive(),
})
export type BulkOrderPadRowInput = z.infer<typeof bulkOrderPadRowInputSchema>

export const resolveBulkOrderRequestSchema = z.object({
  rows: z.array(bulkOrderPadRowInputSchema).min(1).max(200),
})
export type ResolveBulkOrderRequest = z.infer<typeof resolveBulkOrderRequestSchema>

export const bulkOrderMatchedRowSchema = z.object({
  raw: z.string(),
  query: z.string(),
  requestedQty: z.number().int().positive(),
  /** The requested qty snapped up to the listing's MOQ/stepQty, if it wasn't already on the grid — the row is still added at this qty, not silently at the requested one. */
  resolvedQty: z.number().int().positive(),
  listingId: listingIdSchema,
  partId: partIdSchema,
  sellerId: sellerIdSchema,
  sellerName: z.string(),
  title: z.string(),
  unitPricePaise: paiseSchema,
  tierMinQtyApplied: z.number().int().positive(),
})
export type BulkOrderMatchedRow = z.infer<typeof bulkOrderMatchedRowSchema>

export const bulkOrderUnmatchedReasonSchema = z.enum(['not_found', 'out_of_stock', 'invalid_row'])
export type BulkOrderUnmatchedReason = z.infer<typeof bulkOrderUnmatchedReasonSchema>

export const bulkOrderUnmatchedRowSchema = z.object({
  raw: z.string(),
  query: z.string(),
  qty: z.number().int().positive().optional(),
  reason: bulkOrderUnmatchedReasonSchema,
})
export type BulkOrderUnmatchedRow = z.infer<typeof bulkOrderUnmatchedRowSchema>

export const resolveBulkOrderResultSchema = z.object({
  matched: z.array(bulkOrderMatchedRowSchema),
  unmatched: z.array(bulkOrderUnmatchedRowSchema),
})
export type ResolveBulkOrderResult = z.infer<typeof resolveBulkOrderResultSchema>
