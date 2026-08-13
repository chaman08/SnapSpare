import type { ConfirmPaymentResult } from '@snapspare/shared'
import { confirmPayment } from '@/features/checkout/api/confirmPayment'
import { openRazorpayCheckout } from './razorpay'

export interface RazorpayPaymentContext {
  orderId: string
  razorpayOrderId: string
  amountPaise: number
  keyId: string
  buyerName?: string
  buyerPhone?: string
  buyerEmail?: string
  emiEnabled: boolean
}

/**
 * Opens Razorpay Standard Checkout and, on success, calls confirmPayment —
 * shared by the fresh "Place order" flow (right after createOrder) and the
 * "resume payment" flow (an existing pending_payment order), since both end
 * up needing the exact same open-checkout-then-confirm sequence against a
 * Razorpay order id that already exists.
 */
export async function payWithRazorpay(ctx: RazorpayPaymentContext): Promise<ConfirmPaymentResult> {
  const result = await openRazorpayCheckout({
    keyId: ctx.keyId,
    gatewayOrderId: ctx.razorpayOrderId,
    amountPaise: ctx.amountPaise,
    currency: 'INR',
    buyerName: ctx.buyerName ?? '',
    buyerPhone: ctx.buyerPhone,
    buyerEmail: ctx.buyerEmail,
    orderId: ctx.orderId,
    emiEnabled: ctx.emiEnabled,
  })

  return confirmPayment({
    orderId: ctx.orderId,
    razorpayOrderId: result.razorpay_order_id,
    razorpayPaymentId: result.razorpay_payment_id,
    razorpaySignature: result.razorpay_signature,
  })
}
