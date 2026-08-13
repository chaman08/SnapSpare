import { z } from 'zod'
import { orderStatusSchema, paymentMethodSchema } from '../enums'
import { addressIdSchema, listingIdSchema, orderIdSchema, sellerIdSchema } from '../ids'
import { paiseSchema } from '../types/money'
import { gstinSchema, pincodeSchema } from '../validators/indian'

// ---------------------------------------------------------------------------
// checkServiceability
// ---------------------------------------------------------------------------

export const checkServiceabilityRequestSchema = z.object({
  pincode: pincodeSchema,
  sellerIds: z.array(sellerIdSchema).min(1).max(50),
})
export type CheckServiceabilityRequest = z.infer<typeof checkServiceabilityRequestSchema>

export const serviceabilityRejectionReasonSchema = z.enum(['pincode_not_found', 'seller_state_unresolved'])
export type ServiceabilityRejectionReason = z.infer<typeof serviceabilityRejectionReasonSchema>

export const sellerServiceabilitySchema = z.object({
  sellerId: sellerIdSchema,
  serviceable: z.boolean(),
  etaDaysMin: z.number().int().positive().optional(),
  etaDaysMax: z.number().int().positive().optional(),
  codAvailable: z.boolean(),
  reason: serviceabilityRejectionReasonSchema.optional(),
})
export type SellerServiceability = z.infer<typeof sellerServiceabilitySchema>

export const checkServiceabilityResultSchema = z.object({
  pincode: pincodeSchema,
  results: z.array(sellerServiceabilitySchema),
})
export type CheckServiceabilityResult = z.infer<typeof checkServiceabilityResultSchema>

// ---------------------------------------------------------------------------
// createOrder
// ---------------------------------------------------------------------------

export const createOrderItemSchema = z.object({
  listingId: listingIdSchema,
  qty: z.number().int().positive(),
})
export type CreateOrderItem = z.infer<typeof createOrderItemSchema>

/** Only 'razorpay' | 'cod' | 'credit_line' are chooseable at checkout — 'upi'/'card'/'netbanking' are gateway-reported instruments, never something the client asks for directly (see paymentMethodSchema's doc comment for the full enum). */
export const checkoutPaymentMethodSchema = z.enum(['razorpay', 'cod', 'credit_line'])
export type CheckoutPaymentMethod = z.infer<typeof checkoutPaymentMethodSchema>

export const billingDetailsSchema = z.object({
  isBusinessPurchase: z.boolean(),
  gstin: gstinSchema.optional(),
  legalName: z.string().min(1).optional(),
  /** Omit to bill to the same address as shipping. */
  billingAddressId: addressIdSchema.optional(),
})
export type BillingDetails = z.infer<typeof billingDetailsSchema>

export const createOrderRequestSchema = z.object({
  /** Client-generated (e.g. crypto.randomUUID()), stable across retries of the same "Place order" click so a network retry or double-tap never double-charges or double-reserves stock. */
  idempotencyKey: z.string().min(10).max(128),
  items: z.array(createOrderItemSchema).min(1),
  couponCode: z.string().optional(),
  shippingAddressId: addressIdSchema,
  billing: billingDetailsSchema.optional(),
  paymentMethod: checkoutPaymentMethodSchema,
})
export type CreateOrderRequest = z.infer<typeof createOrderRequestSchema>

export const createOrderResultSchema = z.object({
  orderId: orderIdSchema,
  status: orderStatusSchema,
  paymentMethod: paymentMethodSchema,
  totalPaise: paiseSchema,
  /** Present only for paymentMethod === 'razorpay' — everything the client needs to open Razorpay Standard Checkout. */
  razorpay: z
    .object({
      keyId: z.string(),
      gatewayOrderId: z.string(),
      amountPaise: paiseSchema,
      currency: z.literal('INR'),
    })
    .optional(),
})
export type CreateOrderResult = z.infer<typeof createOrderResultSchema>

// ---------------------------------------------------------------------------
// confirmPayment
// ---------------------------------------------------------------------------

export const confirmPaymentRequestSchema = z.object({
  orderId: orderIdSchema,
  razorpayOrderId: z.string().min(1),
  razorpayPaymentId: z.string().min(1),
  razorpaySignature: z.string().min(1),
})
export type ConfirmPaymentRequest = z.infer<typeof confirmPaymentRequestSchema>

export const confirmPaymentResultSchema = z.object({
  status: orderStatusSchema,
})
export type ConfirmPaymentResult = z.infer<typeof confirmPaymentResultSchema>
