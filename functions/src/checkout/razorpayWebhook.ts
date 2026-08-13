import type { PaymentInstrument } from '@snapspare/shared'
import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { getFirestore } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import { onRequest } from 'firebase-functions/v2/https'
import { applyCreditRepayment } from '../credit/applyCreditRepayment.js'
import { queueNotificationDirect } from '../orders/notify.js'
import { applyRefundFailed, applyRefundProcessed, type RazorpayRefundEntity } from '../payments/refundWebhook.js'
import { resolveUserLanguage } from '../seller/notifyLanguage.js'
import { applyPaymentCaptured } from './paymentTransition.js'
import { RAZORPAY_WEBHOOK_SECRET } from './secrets.js'

interface RazorpayPaymentEntity {
  id: string
  order_id: string
  amount: number
  method?: string
  notes?: Record<string, string>
}

interface RazorpayOrderEntity {
  id: string
  amount_paid: number
  status: string
}

interface RazorpayWebhookBody {
  event?: string
  created_at?: number
  payload?: {
    payment?: { entity?: RazorpayPaymentEntity }
    order?: { entity?: RazorpayOrderEntity }
    refund?: { entity?: RazorpayRefundEntity }
  }
}

const KNOWN_INSTRUMENTS: readonly string[] = ['upi', 'card', 'netbanking', 'wallet', 'emi']

function asInstrument(method: string | undefined): PaymentInstrument | undefined {
  return method && KNOWN_INSTRUMENTS.includes(method) ? (method as PaymentInstrument) : undefined
}

function verifySignature(rawBody: Buffer, signatureHeader: string | undefined, secret: string): boolean {
  if (!signatureHeader) return false
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  const expectedBuffer = Buffer.from(expected, 'utf8')
  const providedBuffer = Buffer.from(signatureHeader, 'utf8')
  return expectedBuffer.length === providedBuffer.length && timingSafeEqual(expectedBuffer, providedBuffer)
}

/**
 * Derives a stable idempotency key for this webhook delivery. Prefers the
 * `x-razorpay-event-id` header (present on most current Razorpay webhook
 * deliveries); falls back to a hash of `event + the first entity's id +
 * created_at` when the header is absent, so a retried delivery of the same
 * event still maps to the same `webhookEvents` doc either way.
 */
function deriveWebhookEventKey(headerEventId: string | undefined, body: RazorpayWebhookBody): string {
  if (headerEventId) return headerEventId
  const entityId =
    body.payload?.refund?.entity?.id ?? body.payload?.payment?.entity?.id ?? body.payload?.order?.entity?.id ?? 'unknown'
  const fingerprint = `${body.event ?? 'unknown'}:${entityId}:${body.created_at ?? 0}`
  return createHash('sha256').update(fingerprint).digest('hex')
}

/**
 * Razorpay webhook — the authoritative payment confirmation path (Phase 8,
 * extended in Phase 12 to cover refunds and Khata repayments): fires
 * regardless of whether the buyer's browser is still open. Public HTTPS
 * endpoint — Razorpay calls it directly with no Firebase Auth token, so it
 * must be excluded from any App Check enforcement configured for this
 * project. Protected only by verifying `x-razorpay-signature` against the
 * *raw* request body, which is why this is `onRequest` rather than `onCall`.
 *
 * Every delivery is claimed in `webhookEvents/{key}` via a transactional
 * `create` (fails if the key already exists) *before* any processing —
 * design brief: "every event written to a raw webhookEvents collection
 * before processing so nothing is ever lost" — which also makes a duplicate
 * delivery of the same event a guaranteed no-op rather than relying solely
 * on each handler's own idempotency.
 *
 * Configure this URL in the Razorpay dashboard's webhook settings, subscribed
 * to payment.captured, payment.failed, refund.processed, refund.failed, and
 * order.paid.
 */
export const razorpayWebhook = onRequest(
  { region: 'asia-south1', secrets: [RAZORPAY_WEBHOOK_SECRET] },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method not allowed')
      return
    }

    const signatureHeader = req.headers['x-razorpay-signature']
    const rawBody = req.rawBody
    const signatureValid =
      rawBody !== undefined &&
      verifySignature(rawBody, typeof signatureHeader === 'string' ? signatureHeader : undefined, RAZORPAY_WEBHOOK_SECRET.value())

    if (!signatureValid) {
      res.status(400).send('Invalid signature')
      return
    }

    const body = req.body as RazorpayWebhookBody
    const db = getFirestore()
    const headerEventId = req.headers['x-razorpay-event-id']
    const key = deriveWebhookEventKey(typeof headerEventId === 'string' ? headerEventId : undefined, body)
    const eventRef = db.collection('webhookEvents').doc(key)
    const now = Date.now()

    const claimed = await db
      .runTransaction(async (tx) => {
        const snapshot = await tx.get(eventRef)
        if (snapshot.exists) return false
        tx.set(eventRef, {
          gateway: 'razorpay',
          eventType: body.event ?? 'unknown',
          payload: body as Record<string, unknown>,
          signatureValid,
          status: 'received',
          receivedAt: now,
        })
        return true
      })
      .catch((error) => {
        logger.error('razorpayWebhook: failed to claim webhookEvents doc', { key, error: error instanceof Error ? error.message : String(error) })
        return false
      })

    if (!claimed) {
      // Either a genuine duplicate delivery (already processed — nothing to
      // do) or the claim transaction itself failed (log above covers that
      // case for ops). Ack 200 either way so Razorpay doesn't retry forever.
      res.status(200).send('duplicate')
      return
    }

    let processingError: string | undefined
    try {
      await dispatch(body)
    } catch (error) {
      processingError = error instanceof Error ? error.message : String(error)
      logger.error('razorpayWebhook: handler failed', { key, event: body.event, error: processingError })
    }

    await eventRef
      .update({
        status: processingError ? 'failed' : 'processed',
        processedAt: Date.now(),
        ...(processingError ? { error: processingError } : {}),
      })
      .catch(() => undefined)

    res.status(200).send('ok')
  },
)

async function dispatch(body: RazorpayWebhookBody): Promise<void> {
  const db = getFirestore()

  async function findOrderDoc(razorpayOrderId: string) {
    const orderQuery = await db.collection('orders').where('razorpayOrderId', '==', razorpayOrderId).limit(1).get()
    // createOrder writes razorpayOrderId synchronously before returning to
    // the client, so an empty result should only ever happen for a stale/
    // test event — the caller acks 200 regardless so Razorpay doesn't retry
    // forever against a webhook that will never find a match.
    return orderQuery.docs[0]
  }

  async function applyPaymentToOrder(paymentEntity: RazorpayPaymentEntity): Promise<void> {
    const orderDoc = await findOrderDoc(paymentEntity.order_id)
    if (!orderDoc) return
    await applyPaymentCaptured({
      orderId: orderDoc.id,
      gatewayOrderId: paymentEntity.order_id,
      gatewayPaymentId: paymentEntity.id,
      amountPaise: paymentEntity.amount,
      instrument: asInstrument(paymentEntity.method),
    })
  }

  switch (body.event) {
    case 'payment.captured': {
      const paymentEntity = body.payload?.payment?.entity
      if (!paymentEntity) return

      if (paymentEntity.notes?.purpose === 'credit_repayment') {
        const creditAccountId = paymentEntity.notes.creditAccountId
        const buyerId = paymentEntity.notes.buyerId
        if (!creditAccountId || !buyerId) {
          logger.error('razorpayWebhook: credit_repayment payment missing notes', { paymentId: paymentEntity.id })
          return
        }
        await applyCreditRepayment({
          creditAccountId,
          buyerId,
          gatewayPaymentId: paymentEntity.id,
          amountPaise: paymentEntity.amount,
        })
        return
      }

      // Phase 24: structured log line the payment-success-rate alert's
      // log-based metric (docs/ops/monitoring-alerting.md) is filtered on —
      // deliberately excludes credit_repayment above, which isn't an order
      // checkout payment and would skew the ratio.
      logger.info('razorpayWebhook: payment_outcome', { outcome: 'captured' })
      await applyPaymentToOrder(paymentEntity)
      return
    }
    case 'payment.failed': {
      const paymentEntity = body.payload?.payment?.entity
      if (!paymentEntity || paymentEntity.notes?.purpose === 'credit_repayment') return
      logger.info('razorpayWebhook: payment_outcome', { outcome: 'failed' })
      const orderDoc = await findOrderDoc(paymentEntity.order_id)
      if (!orderDoc || orderDoc.data().status !== 'pending_payment') return
      // Shorten the reservation's grace period instead of releasing
      // immediately — the buyer may still retry the same Razorpay order (a
      // different instrument, or a transient bank decline) from the
      // resume-payment banner. releaseExpiredReservations' regular sweep
      // picks this up once the shortened window lapses.
      const graceMs = 5 * 60_000
      await orderDoc.ref.update({
        paymentStatus: 'failed',
        reservationExpiresAt: Date.now() + graceMs,
        updatedAt: Date.now(),
      })
      const buyerId = orderDoc.data().buyerId as string | undefined
      if (buyerId) {
        await queueNotificationDirect(getFirestore(), {
          userId: buyerId,
          type: 'payment_failed',
          language: await resolveUserLanguage(getFirestore(), buyerId),
          orderId: orderDoc.id,
        })
      }
      return
    }
    case 'order.paid': {
      // Defensive reconciliation for a missed payment.captured delivery —
      // the order entity alone doesn't carry enough to confirm, but Razorpay
      // includes the payment entity alongside it on this event too.
      const paymentEntity = body.payload?.payment?.entity
      if (!paymentEntity || paymentEntity.notes?.purpose === 'credit_repayment') return
      const orderDoc = await findOrderDoc(paymentEntity.order_id)
      if (!orderDoc || orderDoc.data().status !== 'pending_payment') return
      await applyPaymentToOrder(paymentEntity)
      return
    }
    case 'refund.processed': {
      const refundEntity = body.payload?.refund?.entity
      if (refundEntity) await applyRefundProcessed(refundEntity)
      return
    }
    case 'refund.failed': {
      const refundEntity = body.payload?.refund?.entity
      if (refundEntity) await applyRefundFailed(refundEntity)
      return
    }
    default:
      return
  }
}
