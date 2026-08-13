import type { ConfirmPaymentResult, OrderStatus } from '@snapspare/shared'
import { confirmPaymentRequestSchema } from '@snapspare/shared'
import { createHmac } from 'node:crypto'
import { getFirestore } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { applyPaymentCaptured } from './paymentTransition.js'
import { RAZORPAY_KEY_SECRET } from './secrets.js'
import { withSentry } from '../monitoring/withSentry.js'
import { enforceRateLimit } from '../util/rateLimit.js'

/**
 * The client's fast-path call right after Razorpay Standard Checkout
 * reports success. Verifies the same HMAC signature Razorpay itself uses
 * (order_id|payment_id, signed with the key secret) and, if valid, runs the
 * exact same order-confirmation transition the webhook runs — see
 * paymentTransition.ts's doc comment for why that's safe to call twice. The
 * webhook remains authoritative in the sense that it fires unconditionally
 * (this call never does if the buyer closes the tab mid-redirect), not
 * because it re-derives a different answer.
 */
export const confirmPayment = onCall(
  { enforceAppCheck: true, region: 'asia-south1', secrets: [RAZORPAY_KEY_SECRET] },
  withSentry('confirmPayment', async (request): Promise<ConfirmPaymentResult> => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required')

    const parsed = confirmPaymentRequestSchema.safeParse(request.data)
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', 'A valid payment confirmation payload is required')
    }
    const { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = parsed.data

    await enforceRateLimit(request, { name: 'confirmPayment', perUidLimit: 30, perIpLimit: 60, windowMinutes: 60 })

    const db = getFirestore()
    const orderSnapshot = await db.collection('orders').doc(orderId).get()
    if (!orderSnapshot.exists) throw new HttpsError('not-found', 'order_not_found')
    const orderData = orderSnapshot.data()
    if (orderData?.buyerId !== request.auth.uid) throw new HttpsError('permission-denied', 'not_your_order')
    const correlationId = orderData?.correlationId as string | undefined

    const expectedSignature = createHmac('sha256', RAZORPAY_KEY_SECRET.value())
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex')
    if (expectedSignature !== razorpaySignature) {
      logger.error('confirmPayment: signature mismatch', { orderId, correlationId })
      throw new HttpsError('permission-denied', 'invalid_signature')
    }

    const outcome = await applyPaymentCaptured({
      orderId,
      gatewayOrderId: razorpayOrderId,
      gatewayPaymentId: razorpayPaymentId,
      amountPaise: (orderData?.totalPaise as number | undefined) ?? 0,
    })
    if (outcome === 'order_not_found') throw new HttpsError('not-found', 'order_not_found')

    logger.info('confirmPayment: payment confirmed', { orderId, correlationId, outcome })

    const finalSnapshot = await db.collection('orders').doc(orderId).get()
    const status = (finalSnapshot.data()?.status as OrderStatus | undefined) ?? 'pending_payment'
    return { status }
  }),
)
