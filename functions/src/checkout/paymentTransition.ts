import { type PaymentInstrument, orderSchema, sellerSchema, subOrderSchema } from '@snapspare/shared'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { appendTimelineEntry } from '../orders/timeline.js'
import { queueNotificationDirect } from '../orders/notify.js'
import { resolveUserLanguage } from '../seller/notifyLanguage.js'
import { stripUndefined } from '../util/stripUndefined.js'
import { getAppConfig } from './appConfig.js'

export interface PaymentCapturedInput {
  orderId: string
  gatewayOrderId: string
  gatewayPaymentId: string
  amountPaise: number
  instrument?: PaymentInstrument
}

export type PaymentCapturedOutcome = 'confirmed' | 'already_processed' | 'order_not_pending' | 'order_not_found'

/**
 * The single place a captured Razorpay payment turns into a confirmed
 * order — both confirmPayment (the client's optimistic fast path) and
 * razorpayWebhook (the authoritative, always-fires path) call this exact
 * function, keyed by `gatewayPaymentId` so whichever one arrives first wins
 * and the other is a no-op (design spec: "duplicate webhook (idempotency
 * key on gatewayPaymentId)" covers both duplicate webhook deliveries *and*
 * confirmPayment racing the webhook, since they funnel through the same
 * check).
 *
 * Converts the stock reservation into a real commitment here (decrements
 * both `stockQty` and `reservedStock` together) rather than at order-creation
 * time — see packages/shared/src/schemas/listing.ts's `reservedStock` doc
 * comment for the reserve → commit/release lifecycle this is the "commit"
 * half of.
 */
export async function applyPaymentCaptured(input: PaymentCapturedInput): Promise<PaymentCapturedOutcome> {
  const db = getFirestore()
  const paymentRef = db.collection('payments').doc(input.gatewayPaymentId)
  const orderRef = db.collection('orders').doc(input.orderId)
  const config = await getAppConfig()
  const sellerAcceptSlaMs = config.sellerAcceptSlaHours * 60 * 60_000

  let confirmedBuyerId: string | undefined
  const confirmedSubOrders: { sellerId: string; subOrderId: string }[] = []

  const outcome = await db.runTransaction(async (tx) => {
    const [paymentSnapshot, orderSnapshot] = await Promise.all([tx.get(paymentRef), tx.get(orderRef)])

    if (paymentSnapshot.exists && paymentSnapshot.data()?.status === 'captured') {
      return 'already_processed'
    }
    if (!orderSnapshot.exists) return 'order_not_found'

    const order = orderSchema.parse({ id: orderSnapshot.id, ...orderSnapshot.data() })
    const now = Date.now()

    if (order.status !== 'pending_payment') {
      // Already confirmed by the other path, or already cancelled by
      // releaseExpiredReservations before this late payment arrived (a
      // reconciliation/refund follow-up — see README notes). Either way,
      // record the payment for audit but never touch stock a second time.
      if (!paymentSnapshot.exists) {
        tx.set(
          paymentRef,
          stripUndefined({
            orderId: input.orderId,
            buyerId: order.buyerId,
            gateway: 'razorpay',
            gatewayOrderId: input.gatewayOrderId,
            gatewayPaymentId: input.gatewayPaymentId,
            instrument: input.instrument,
            status: 'captured',
            amountPaise: input.amountPaise,
            amountRefundedPaise: 0,
            webhookVerifiedAt: now,
            createdAt: now,
            updatedAt: now,
          }),
        )
      }
      return 'order_not_pending'
    }

    const subOrderRefs = order.subOrderIds.map((id) => db.collection('subOrders').doc(id))
    const subOrderSnapshots = await Promise.all(subOrderRefs.map((ref) => tx.get(ref)))

    for (const snapshot of subOrderSnapshots) {
      if (!snapshot.exists) continue
      const subOrder = subOrderSchema.parse({ id: snapshot.id, ...snapshot.data() })
      confirmedSubOrders.push({ sellerId: subOrder.sellerId, subOrderId: subOrder.id })
      for (const item of subOrder.items) {
        tx.update(db.collection('listings').doc(item.listingId), {
          stockQty: FieldValue.increment(-item.qty),
          reservedStock: FieldValue.increment(-item.qty),
          updatedAt: now,
        })
        // Payment just captured — the reservation converts to a real sale
        // (requirement 5's stock ledger).
        tx.set(db.collection('stockLedger').doc(), {
          listingId: item.listingId,
          sellerId: subOrder.sellerId,
          deltaQty: -item.qty,
          reason: 'sale',
          referenceId: subOrder.id,
          createdAt: now,
        })
      }
      // The seller-accept SLA clock starts now, not at order placement — a
      // razorpay subOrder has nothing for the seller to act on until it's
      // actually paid for (see createOrder.ts's mirrored cod/credit_line
      // path, which sets this at creation time instead).
      tx.update(snapshot.ref, {
        slaAcceptByAt: now + sellerAcceptSlaMs,
        timeline: appendTimelineEntry(subOrder.timeline, 'pending', { type: 'system' }, undefined, now),
        updatedAt: now,
      })
    }

    tx.update(orderRef, {
      status: 'confirmed',
      paymentStatus: 'paid',
      confirmedAt: now,
      updatedAt: now,
    })

    tx.set(
      paymentRef,
      stripUndefined({
        orderId: input.orderId,
        buyerId: order.buyerId,
        gateway: 'razorpay',
        gatewayOrderId: input.gatewayOrderId,
        gatewayPaymentId: input.gatewayPaymentId,
        instrument: input.instrument,
        status: 'captured',
        amountPaise: input.amountPaise,
        amountRefundedPaise: 0,
        webhookVerifiedAt: now,
        createdAt: now,
        updatedAt: now,
      }),
    )

    confirmedBuyerId = order.buyerId
    return 'confirmed'
  })

  if (outcome === 'confirmed' && confirmedBuyerId) {
    const buyerId = confirmedBuyerId
    await queueNotificationDirect(db, {
      userId: buyerId,
      type: 'payment_confirmed',
      language: await resolveUserLanguage(db, buyerId),
      orderId: input.orderId,
    })

    // A razorpay subOrder only becomes actionable by its seller once payment
    // clears — see createOrder.ts's mirrored cod/credit_line path, which
    // queues this at order creation instead since there's nothing to wait for.
    await Promise.all(
      confirmedSubOrders.map(async ({ sellerId, subOrderId }) => {
        const sellerSnapshot = await db.collection('sellers').doc(sellerId).get()
        if (!sellerSnapshot.exists) return
        const seller = sellerSchema.safeParse({ id: sellerSnapshot.id, ...sellerSnapshot.data() })
        if (!seller.success) return
        await queueNotificationDirect(db, {
          userId: seller.data.ownerUserId,
          type: 'new_order_for_seller',
          language: await resolveUserLanguage(db, seller.data.ownerUserId),
          orderId: input.orderId,
          subOrderId,
        })
      }),
    )
  }

  return outcome
}
