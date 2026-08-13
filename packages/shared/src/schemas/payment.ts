import { z } from 'zod'
import { makeFirestoreConverter } from '../firestore/converter'
import { orderIdSchema, paymentIdSchema, userIdSchema } from '../ids'
import { paiseSchema } from '../types/money'
import { epochMsSchema } from './common'

export const paymentGatewaySchema = z.enum(['razorpay'])
export type PaymentGateway = z.infer<typeof paymentGatewaySchema>

export const paymentInstrumentSchema = z.enum(['upi', 'card', 'netbanking', 'wallet', 'emi'])
export type PaymentInstrument = z.infer<typeof paymentInstrumentSchema>

export const paymentRecordStatusSchema = z.enum([
  'created',
  'authorized',
  'captured',
  'failed',
  'refunded',
  'partially_refunded',
])
export type PaymentRecordStatus = z.infer<typeof paymentRecordStatusSchema>

/**
 * One document per gateway payment attempt, keyed by `gatewayPaymentId` so a
 * duplicate webhook delivery (or a confirmPayment call racing the webhook)
 * is a no-op the second time — see functions/src/checkout/paymentTransition.ts,
 * the single place both paths funnel through. Only ever written by Cloud
 * Functions (Admin SDK); the client only ever reads its own order's payment.
 */
export const paymentSchema = z.object({
  id: paymentIdSchema,
  orderId: orderIdSchema,
  buyerId: userIdSchema,
  gateway: paymentGatewaySchema,
  gatewayOrderId: z.string().min(1),
  gatewayPaymentId: z.string().min(1).optional(),
  instrument: paymentInstrumentSchema.optional(),
  status: paymentRecordStatusSchema,
  amountPaise: paiseSchema,
  amountRefundedPaise: paiseSchema.default(0),
  failureReason: z.string().optional(),
  webhookVerifiedAt: epochMsSchema.optional(),
  createdAt: epochMsSchema,
  updatedAt: epochMsSchema,
})
export type Payment = z.infer<typeof paymentSchema>

export const paymentConverter = makeFirestoreConverter(paymentSchema)
