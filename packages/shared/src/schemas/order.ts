import { z } from 'zod'
import { buyerTypeSchema, orderStatusSchema, paymentMethodSchema, paymentStatusSchema } from '../enums'
import { makeFirestoreConverter } from '../firestore/converter'
import { orderIdSchema, subOrderIdSchema, userIdSchema } from '../ids'
import { gstinSchema } from '../validators/indian'
import { addressSnapshotSchema, epochMsSchema } from './common'
import { timelineEntrySchema } from './orderTimeline'

export const orderSchema = z.object({
  id: orderIdSchema,
  buyerId: userIdSchema,
  buyerType: buyerTypeSchema,
  status: orderStatusSchema,
  subOrderIds: z.array(subOrderIdSchema).min(1),
  shippingAddress: addressSnapshotSchema,
  billingGstin: gstinSchema.optional(),
  /** Legal registered business name shown on the GST invoice — only meaningful alongside billingGstin. */
  billingLegalName: z.string().min(1).optional(),
  /** Present only when the buyer's billing address differs from shippingAddress (e.g. head-office GSTIN, warehouse delivery). Absent means shippingAddress doubles as the billing address. */
  billingAddress: addressSnapshotSchema.optional(),
  subtotalPaise: z.number().int().nonnegative(),
  discountPaise: z.number().int().nonnegative(),
  shippingPaise: z.number().int().nonnegative(),
  taxPaise: z.number().int().nonnegative(),
  /** Flat COD handling fee, disclosed at checkout and included in totalPaise. Always 0 for non-COD orders. */
  codFeePaise: z.number().int().nonnegative().default(0),
  totalPaise: z.number().int().nonnegative(),
  couponCode: z.string().optional(),
  paymentMethod: paymentMethodSchema,
  paymentStatus: paymentStatusSchema,
  /** The createOrder request's client-supplied idempotency key, kept for audit/debugging duplicate-submission reports. */
  idempotencyKey: z.string().min(1),
  /**
   * Phase 22 monitoring: a server-generated id (crypto.randomUUID(), set once
   * by createOrder.ts) threaded through every log line and Sentry scope for
   * every function that subsequently touches this order — payment capture,
   * shipping, invoicing, notifications — so a support engineer can pull the
   * full cross-function trace for one order from Cloud Logging by filtering
   * on a single field instead of correlating by orderId across differently-
   * shaped log lines. Mirrors the existing idempotency-key precedent
   * (checkout/idempotency.ts) rather than introducing request headers.
   */
  correlationId: z.string().min(1),
  /** Razorpay's order id (rzp_order_...) once created — absent for cod/credit_line orders, which never touch the gateway. */
  razorpayOrderId: z.string().optional(),
  /** Only set while status === 'pending_payment': the moment releaseExpiredReservations is allowed to cancel this order and release its stock hold. */
  reservationExpiresAt: epochMsSchema.optional(),
  confirmedAt: epochMsSchema.optional(),
  cancelledReason: z
    .enum(['reservation_expired', 'payment_failed', 'gateway_error', 'all_subOrders_cancelled'])
    .optional(),
  /** Append-only order-level audit trail, one entry per aggregate status change — see orders/aggregateOrderStatus.ts. Distinct from each subOrder's own (more granular) timeline. */
  timeline: z.array(timelineEntrySchema).default([]),
  placedAt: epochMsSchema,
  createdAt: epochMsSchema,
  updatedAt: epochMsSchema,
})
export type Order = z.infer<typeof orderSchema>

export const orderConverter = makeFirestoreConverter(orderSchema)
