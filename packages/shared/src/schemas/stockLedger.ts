import { z } from 'zod'
import { makeFirestoreConverter } from '../firestore/converter'
import { listingIdSchema, sellerIdSchema, userIdSchema } from '../ids'
import { callableRequestSchema, epochMsSchema } from './common'

export const stockLedgerEntryIdSchema = z.string().min(1)
export type StockLedgerEntryId = z.infer<typeof stockLedgerEntryIdSchema>

export const stockAdjustReasonSchema = z.enum(['restock', 'sale', 'return', 'adjustment', 'correction', 'replacement'])
export type StockAdjustReason = z.infer<typeof stockAdjustReasonSchema>

/**
 * One append-only row per stock movement (requirement 5's stock ledger
 * view). `balanceAfter` is only ever set by `adjustStock.ts` — the manual
 * seller-facing path, which reads the listing inside its own transaction
 * before writing, so it always knows the resulting balance. The five
 * order-lifecycle call sites retrofitted onto `restoreStockInTx`
 * (cancelSubOrder, rejectSubOrder, autoCancelUnacceptedSubOrders,
 * refundReturn, processRtoRefund) and the two sale-decrement call sites
 * (createOrder, paymentTransition) use `FieldValue.increment()` without a
 * prior read — reordering five payment-critical transactions' read/write
 * sequencing just to populate this one display field wasn't worth the
 * blast radius, so `balanceAfter` is optional and absent on those entries;
 * the delta/reason/timestamp trail is still complete.
 */
export const stockLedgerEntrySchema = z.object({
  id: stockLedgerEntryIdSchema,
  listingId: listingIdSchema,
  sellerId: sellerIdSchema,
  deltaQty: z.number().int(),
  reason: stockAdjustReasonSchema,
  actorId: userIdSchema.optional(),
  /** subOrderId/returnId/etc. this movement was posted from, for cross-reference — absent for a manual adjustStock entry. */
  referenceId: z.string().optional(),
  note: z.string().max(500).optional(),
  balanceAfter: z.number().int().nonnegative().optional(),
  createdAt: epochMsSchema,
})
export type StockLedgerEntry = z.infer<typeof stockLedgerEntrySchema>

export const stockLedgerEntryConverter = makeFirestoreConverter(stockLedgerEntrySchema)

export const adjustStockRequestSchema = callableRequestSchema(
  z.object({
    listingId: listingIdSchema,
    deltaQty: z.number().int().refine((v) => v !== 0, 'deltaQty must not be zero'),
    reason: z.enum(['restock', 'adjustment', 'correction']),
    note: z.string().max(500).optional(),
  }),
)
export type AdjustStockRequest = z.infer<typeof adjustStockRequestSchema>

export const adjustStockResultSchema = z.object({
  balanceAfter: z.number().int().nonnegative(),
})
export type AdjustStockResult = z.infer<typeof adjustStockResultSchema>
