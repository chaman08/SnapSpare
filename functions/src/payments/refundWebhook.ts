import { paymentSchema, sellerSchema } from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import { queueNotificationDirect } from '../orders/notify.js'
import { postLedgerEntries, readLedger } from '../tax/ledger.js'

export interface RazorpayRefundEntity {
  id: string
  payment_id: string
  amount: number
  notes?: Record<string, string>
}

/**
 * Reconciles a `refund.processed` webhook — the gateway's confirmation that
 * money actually left the platform's account, so this (not refundEngine.ts's
 * optimistic initiating call) is the source of truth for both the payment
 * record and the seller's `refund_debit` ledger entry. Never called twice
 * for the same event: razorpayWebhook.ts claims each event id in
 * `webhookEvents` before dispatching, so this function has no idempotency
 * concerns of its own to worry about. The seller/subOrder/returnId carried
 * in the refund's `notes` (always set by refundEngine.ts's
 * createRazorpayRefund call) is what lets this post the `refund_debit`
 * ledger entry without re-deriving it from the payment alone.
 */
export async function applyRefundProcessed(entity: RazorpayRefundEntity): Promise<void> {
  const db = getFirestore()
  const paymentSnapshot = await db
    .collection('payments')
    .where('gatewayPaymentId', '==', entity.payment_id)
    .limit(1)
    .get()
  const paymentDoc = paymentSnapshot.docs[0]
  if (!paymentDoc) {
    logger.warn('applyRefundProcessed: no matching payment', { refundId: entity.id, paymentId: entity.payment_id })
    return
  }
  const payment = paymentSchema.parse({ id: paymentDoc.id, ...paymentDoc.data() })
  const sellerId = entity.notes?.sellerId
  const now = Date.now()
  const newRefundedTotal = payment.amountRefundedPaise + entity.amount

  await paymentDoc.ref.update({
    amountRefundedPaise: newRefundedTotal,
    status: newRefundedTotal >= payment.amountPaise ? 'refunded' : 'partially_refunded',
    updatedAt: now,
  })
  await db
    .collection('orders')
    .doc(payment.orderId)
    .update({
      paymentStatus: newRefundedTotal >= payment.amountPaise ? 'refunded' : 'partially_refunded',
      updatedAt: now,
    })

  if (sellerId) {
    await db.runTransaction(async (tx) => {
      const ledgerRead = await readLedger(tx, db, sellerId)
      postLedgerEntries(
        tx,
        db,
        ledgerRead,
        sellerId,
        [
          {
            type: 'refund_debit',
            direction: 'debit',
            amountPaise: entity.amount,
            referenceType: 'return',
            referenceId: entity.notes?.returnId,
            description: `Gateway refund ${entity.id} confirmed`,
          },
        ],
        now,
      )
    })
  }
}

/** `refund.failed` — logs for manual ops follow-up and notifies the seller (if identifiable) that a buyer refund needs attention. No automatic retry: Razorpay refund failures are usually account/balance issues that need a human. */
export async function applyRefundFailed(entity: RazorpayRefundEntity): Promise<void> {
  logger.error('applyRefundFailed: gateway refund failed', { refundId: entity.id, paymentId: entity.payment_id, notes: entity.notes })

  const sellerId = entity.notes?.sellerId
  if (!sellerId) return

  const db = getFirestore()
  const sellerSnapshot = await db.collection('sellers').doc(sellerId).get()
  if (!sellerSnapshot.exists) return
  const seller = sellerSchema.parse({ id: sellerSnapshot.id, ...sellerSnapshot.data() })

  await queueNotificationDirect(db, {
    userId: seller.ownerUserId,
    type: 'refund_failed',
    language: 'en',
    subOrderId: entity.notes?.subOrderId,
    returnId: entity.notes?.returnId,
  })
}
