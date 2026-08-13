import {
  computeLineRefund,
  type LedgerEntryReferenceType,
  type LedgerEntryType,
  orderSchema,
  paymentSchema,
  refundBankDetailSchema,
  subOrderSchema,
  sumLineRefunds,
} from '@snapspare/shared'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import { getAppConfig } from '../checkout/appConfig.js'
import { createRazorpayRefund } from '../checkout/razorpayClient.js'
import { RAZORPAY_KEY_SECRET } from '../checkout/secrets.js'
import { queueNotificationDirect } from '../orders/notify.js'
import { resolveUserLanguage } from '../seller/notifyLanguage.js'
import { postLedgerEntries, readLedger } from '../tax/ledger.js'
import { payoutProvider } from './provider.js'

export interface RefundLineInput {
  listingId: string
  qty: number
}

export interface ExecuteRefundInput {
  orderId: string
  subOrderId: string
  items: RefundLineInput[]
  /** Present for a return/RTO-driven refund; absent for a pre-shipment cancel/reject (no return doc exists yet). */
  returnId?: string
  reason: string
  /** When set, refunds this exact amount instead of computing it from `items` via computeLineRefund — used by disputes/resolveDispute.ts for an admin-specified (possibly partial) forced refund. `items` is still required (the listing must belong to the subOrder) but its qty is not used to derive the amount in this case. */
  overrideAmountPaise?: number
  /** Overrides the seller-ledger principal-debit entry's `type`/`referenceType`/`referenceId`/`description` — used by disputes/resolveDispute.ts to tag a forced refund distinctly (`dispute_refund_debit`, referencing the dispute, with the admin's mandatory note as the description) instead of the default return/cancellation shape. The commission-reversal entry alongside it is unaffected. */
  ledgerEntryOverride?: {
    type: LedgerEntryType
    referenceType: LedgerEntryReferenceType
    referenceId: string
    description: string
  }
}

export type RefundOutcome =
  | 'no_payment_collected'
  | 'credit_line_reversed'
  | 'gateway_refund_initiated'
  | 'gateway_refund_failed'
  | 'cod_bank_transfer_sent'
  | 'cod_pending_bank_details'
  | 'cod_bank_transfer_failed'

export interface ExecuteRefundResult {
  totalRefundPaise: number
  outcome: RefundOutcome
}

/**
 * Single refund path used by every subOrder-money-reversal call site
 * (refundReturn.ts, cancelSubOrder.ts, rejectSubOrder.ts, processRtoRefund.ts)
 * — design brief item 2. Computes the refund from the original line values
 * (proportional discount/tax reversal via computeLineRefund), then branches
 * on how the order was paid for. Always call this *after* the caller's own
 * status-transition transaction has committed — like processRtoRefund.ts's
 * existing shape, this function makes external API calls (Razorpay, the
 * payout provider) which must never run inside a Firestore transaction that
 * might retry on contention.
 *
 * The seller's ledger is only ever touched here when the subOrder had
 * already reached `delivered` (i.e. `commissionPaise` is set — see
 * applyCommissionOnDelivered.ts) — before that, `order_credit`/
 * `commission_debit` were never posted, so there is nothing on the seller's
 * side to reverse; the refund is purely a buyer-facing reversal in that case.
 */
export async function executeRefund(input: ExecuteRefundInput): Promise<ExecuteRefundResult> {
  const db = getFirestore()

  const [orderSnapshot, subOrderSnapshot] = await Promise.all([
    db.collection('orders').doc(input.orderId).get(),
    db.collection('subOrders').doc(input.subOrderId).get(),
  ])
  if (!orderSnapshot.exists) throw new Error(`executeRefund: order ${input.orderId} not found`)
  if (!subOrderSnapshot.exists) throw new Error(`executeRefund: subOrder ${input.subOrderId} not found`)
  const order = orderSchema.parse({ id: orderSnapshot.id, ...orderSnapshot.data() })
  const subOrder = subOrderSchema.parse({ id: subOrderSnapshot.id, ...subOrderSnapshot.data() })

  const itemByListingId = new Map(subOrder.items.map((item) => [item.listingId, item]))
  // Always validate every referenced listing actually belongs to this
  // subOrder, even when overrideAmountPaise bypasses the computed amount —
  // a dispute/warranty resolution should still only reference real lines.
  for (const line of input.items) {
    if (!itemByListingId.has(line.listingId)) {
      throw new Error(`executeRefund: listing ${line.listingId} not in subOrder ${subOrder.id}`)
    }
  }
  const totalRefundPaise =
    input.overrideAmountPaise ??
    sumLineRefunds(
      input.items.map((line) => computeLineRefund(itemByListingId.get(line.listingId)!, line.qty)),
    ).totalPaise
  const now = Date.now()

  // Was this subOrder ever commissioned (i.e. did it reach 'delivered'
  // before being returned)? Only then is there anything on the seller's
  // ledger to reverse — see the doc comment above.
  const wasCommissioned = subOrder.commissionPaise !== undefined
  const commissionReversalPaise =
    wasCommissioned && subOrder.totalPaise > 0
      ? Math.round(((subOrder.commissionPaise ?? 0) * totalRefundPaise) / subOrder.totalPaise)
      : 0

  async function postSellerLedgerReversal(): Promise<void> {
    if (!wasCommissioned || totalRefundPaise === 0) return
    await db.runTransaction(async (tx) => {
      const ledgerRead = await readLedger(tx, db, subOrder.sellerId)
      postLedgerEntries(
        tx,
        db,
        ledgerRead,
        subOrder.sellerId,
        [
          {
            type: input.ledgerEntryOverride?.type ?? 'refund_debit',
            direction: 'debit',
            amountPaise: totalRefundPaise,
            referenceType: input.ledgerEntryOverride?.referenceType ?? 'subOrder',
            referenceId: input.ledgerEntryOverride?.referenceId ?? subOrder.id,
            description: input.ledgerEntryOverride?.description ?? `Refund for ${input.reason}`,
          },
          {
            type: 'commission_debit',
            direction: 'credit',
            amountPaise: commissionReversalPaise,
            referenceType: 'subOrder',
            referenceId: subOrder.id,
            description: `Commission reversal for ${input.reason}`,
          },
        ],
        now,
      )
    })
  }

  if (totalRefundPaise === 0) {
    return { totalRefundPaise: 0, outcome: 'no_payment_collected' }
  }

  // ---- credit_line ----
  if (order.paymentMethod === 'credit_line') {
    const creditSnapshot = await db.collection('creditAccounts').where('buyerId', '==', order.buyerId).limit(1).get()
    const creditDoc = creditSnapshot.docs[0]
    if (creditDoc) {
      await creditDoc.ref.update({
        availableCreditPaise: FieldValue.increment(totalRefundPaise),
        outstandingPaise: FieldValue.increment(-totalRefundPaise),
        updatedAt: now,
      })
    }
    await postSellerLedgerReversal()
    return { totalRefundPaise, outcome: 'credit_line_reversed' }
  }

  // ---- cod: nothing was ever collected before delivery ----
  if (order.paymentMethod === 'cod' && order.paymentStatus !== 'paid') {
    return { totalRefundPaise, outcome: 'no_payment_collected' }
  }

  // ---- cod, cash collected at delivery: refund to bank via the payout provider ----
  if (order.paymentMethod === 'cod') {
    if (!input.returnId) {
      // No return doc means this is a pre-shipment cancel/reject, which
      // can't happen for a COD order whose cash was already collected
      // (collection only happens at delivery — see applyCommissionOnDelivered.ts).
      logger.error('executeRefund: COD refund requested with no returnId', { subOrderId: subOrder.id })
      return { totalRefundPaise, outcome: 'cod_bank_transfer_failed' }
    }
    const bankDetailSnapshot = await db
      .collection('refundBankDetails')
      .where('returnId', '==', input.returnId)
      .where('status', '==', 'pending')
      .limit(1)
      .get()
    const bankDetailDoc = bankDetailSnapshot.docs[0]
    if (!bankDetailDoc) {
      return { totalRefundPaise, outcome: 'cod_pending_bank_details' }
    }
    const bankDetail = refundBankDetailSchema.parse({ id: bankDetailDoc.id, ...bankDetailDoc.data() })

    try {
      const result = await payoutProvider.payToBank({
        accountHolderName: bankDetail.accountHolderName,
        accountNumber: bankDetail.accountNumber,
        ifsc: bankDetail.ifsc,
        amountPaise: totalRefundPaise,
        reference: bankDetail.id,
      })
      if (result.status !== 'processed') throw new Error(result.failureReason ?? 'payout_provider_failed')

      await bankDetailDoc.ref.update({ status: 'used', updatedAt: Date.now() })
      await postSellerLedgerReversal()
      return { totalRefundPaise, outcome: 'cod_bank_transfer_sent' }
    } catch (error) {
      logger.error('executeRefund: COD bank transfer failed', {
        subOrderId: subOrder.id,
        returnId: input.returnId,
        error: error instanceof Error ? error.message : String(error),
      })
      await queueNotificationDirect(db, {
        userId: order.buyerId,
        type: 'refund_failed',
        language: 'en',
        orderId: order.id,
        subOrderId: subOrder.id,
        returnId: input.returnId,
      })
      return { totalRefundPaise, outcome: 'cod_bank_transfer_failed' }
    }
  }

  // ---- prepaid gateway (razorpay/upi/card/netbanking): refund via Razorpay ----
  if (order.paymentStatus !== 'paid') {
    return { totalRefundPaise, outcome: 'no_payment_collected' }
  }

  try {
    const paymentSnapshot = await db
      .collection('payments')
      .where('orderId', '==', order.id)
      .where('status', 'in', ['captured', 'partially_refunded'])
      .limit(1)
      .get()
    const paymentDoc = paymentSnapshot.docs[0]
    if (!paymentDoc) throw new Error('no_captured_payment_found')
    const payment = paymentSchema.parse({ id: paymentDoc.id, ...paymentDoc.data() })

    const config = await getAppConfig()
    if (!config.razorpayKeyId) throw new Error('config/app.razorpayKeyId is not set')

    await createRazorpayRefund({
      keyId: config.razorpayKeyId,
      keySecret: RAZORPAY_KEY_SECRET.value(),
      razorpayPaymentId: payment.gatewayPaymentId ?? paymentDoc.id,
      amountPaise: totalRefundPaise,
      notes: {
        orderId: order.id,
        subOrderId: subOrder.id,
        sellerId: subOrder.sellerId,
        returnId: input.returnId ?? '',
        reason: input.reason,
      },
    })

    // Optimistic bookkeeping only — refundWebhook.ts's refund.processed
    // handler is the authoritative confirmation and will reconcile
    // amountRefundedPaise/status once Razorpay confirms.
    const newRefundedTotal = payment.amountRefundedPaise + totalRefundPaise
    await paymentDoc.ref.update({
      amountRefundedPaise: newRefundedTotal,
      status: newRefundedTotal >= payment.amountPaise ? 'refunded' : 'partially_refunded',
      updatedAt: now,
    })
    await postSellerLedgerReversal()
    // "Initiated" here, not "completed" — refundWebhook.ts's refund.processed
    // handler is what confirms the refund actually landed (return_refunded).
    await queueNotificationDirect(db, {
      userId: order.buyerId,
      type: 'refund_initiated',
      language: await resolveUserLanguage(db, order.buyerId),
      orderId: order.id,
      subOrderId: subOrder.id,
      returnId: input.returnId,
    })
    return { totalRefundPaise, outcome: 'gateway_refund_initiated' }
  } catch (error) {
    logger.error('executeRefund: Razorpay refund failed', {
      subOrderId: subOrder.id,
      orderId: order.id,
      error: error instanceof Error ? error.message : String(error),
    })
    await queueNotificationDirect(db, {
      userId: order.buyerId,
      type: 'refund_failed',
      language: 'en',
      orderId: order.id,
      subOrderId: subOrder.id,
      returnId: input.returnId,
    })
    // Stock/status bookkeeping already committed by the caller before this
    // ran — a gateway failure here shouldn't be treated as the whole
    // operation failing, just a refund that needs manual/webhook follow-up.
    return { totalRefundPaise, outcome: 'gateway_refund_failed' }
  }
}
