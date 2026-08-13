import { z } from 'zod'
import { orderStatusSchema } from '../enums'
import { orderIdSchema, subOrderIdSchema } from '../ids'
import { epochMsSchema } from './common'

/**
 * Orders module (design brief item 6) admin overrides. `forceStatus` is a
 * narrow order-level override for stuck support cases — it does not cascade
 * to subOrders, so use it only when the aggregate `orders/{id}.status` is
 * genuinely out of sync with reality (the normal path is
 * aggregateOrderStatus.ts recomputing it from subOrder writes).
 * `forceCancelSubOrder` mirrors cancelSubOrder.ts's own logic (restore
 * stock, cancel, refund) but admin-authorized and without the
 * buyer/seller-participant check, for a subOrder support can't otherwise
 * reach. `forceRefund` is a standalone money-only action (no status change)
 * for a goodwill/support refund against a subOrder, independent of the
 * dispute-resolution refund path in resolveDispute.ts.
 */
export const adminForceOrderActionRequestSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('forceStatus'), orderId: orderIdSchema, status: orderStatusSchema, reason: z.string().min(1) }),
  z.object({ action: z.literal('forceCancelSubOrder'), subOrderId: subOrderIdSchema, reason: z.string().min(1) }),
  z.object({
    action: z.literal('forceRefund'),
    subOrderId: subOrderIdSchema,
    refundAmountPaise: z.number().int().positive(),
    reason: z.string().min(1),
  }),
])
export type AdminForceOrderActionRequest = z.infer<typeof adminForceOrderActionRequestSchema>

export const adminForceOrderActionResultSchema = z.object({ ok: z.literal(true) })
export type AdminForceOrderActionResult = z.infer<typeof adminForceOrderActionResultSchema>

/** One row of the payment reconciliation report (Orders module design brief item 6). */
export const paymentReconciliationRowSchema = z.object({
  orderId: orderIdSchema,
  placedAt: epochMsSchema,
  paymentMethod: z.string(),
  paymentStatus: z.string(),
  orderStatus: z.string(),
  totalPaise: z.number().int().nonnegative(),
  /** Flags why this order surfaced: unresolved gateway payment, or a payment marked paid with no matching order status progress, etc. */
  issue: z.enum(['pending_payment_stale', 'failed_payment', 'paid_but_uncancelled_reservation']),
})
export type PaymentReconciliationRow = z.infer<typeof paymentReconciliationRowSchema>

export const getPaymentReconciliationReportRequestSchema = z.object({
  lookbackDays: z.number().int().positive().max(90).default(7),
})
export type GetPaymentReconciliationReportRequest = z.infer<typeof getPaymentReconciliationReportRequestSchema>

export const getPaymentReconciliationReportResultSchema = z.object({
  rows: z.array(paymentReconciliationRowSchema),
})
export type GetPaymentReconciliationReportResult = z.infer<typeof getPaymentReconciliationReportResultSchema>
