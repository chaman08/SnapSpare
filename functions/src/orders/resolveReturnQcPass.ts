import {
  computeLineRefund,
  orderSchema,
  type Return,
  type ReturnQc,
  subOrderSchema,
  type TimelineActor,
} from '@snapspare/shared'
import { FieldValue, type Firestore, type Transaction } from 'firebase-admin/firestore'
import { HttpsError } from 'firebase-functions/v2/https'
import { queueNotification } from './notify.js'
import { restoreStockInTx } from './stockOps.js'
import { appendTimelineEntry } from './timeline.js'
import { stripUndefined } from '../util/stripUndefined.js'

export interface ResolveReturnQcPassResult {
  orderId: string
  subOrderId: string
  listingId: string
  qty: number
  resolutionPreference: 'refund' | 'replacement'
  refundAmountPaise?: number
  replacementSubOrderId?: string
}

/**
 * Applies the outcome of a QC pass — refund or replacement, per the return's
 * `resolutionPreference` — inside the caller's transaction. Called from both
 * `submitReturnQc.ts` (manual seller pass) and `autoPassReturnQc.ts`
 * (system auto-pass after config/returns.qcAutoPassDays), so this refund/
 * replacement logic lives in exactly one place. All reads (subOrder, order,
 * buyer, and — for a COD refund — refundBankDetails) happen before any
 * writes, as Firestore transactions require; the caller must not have
 * issued any writes yet when calling this.
 *
 * The refund branch mirrors refundReturn.ts's transaction body (that
 * callable remains the manual "I've already received this back, refund it"
 * path — mostly superseded by the QC flow now, but still valid for a
 * seller who wants to skip straight to refund). The actual gateway/credit-
 * line/bank-transfer call (executeRefund) must run AFTER the caller's
 * transaction commits — never from in here.
 */
export async function resolveReturnQcPassInTx(
  tx: Transaction,
  db: Firestore,
  ret: Return,
  qc: ReturnQc,
  actor: TimelineActor,
  now: number,
): Promise<ResolveReturnQcPassResult> {
  const returnRef = db.collection('returns').doc(ret.id)
  const subOrderRef = db.collection('subOrders').doc(ret.subOrderId)
  const orderRef = db.collection('orders').doc(ret.orderId)

  const [subOrderSnapshot, orderSnapshot, buyerSnapshot] = await Promise.all([
    tx.get(subOrderRef),
    tx.get(orderRef),
    tx.get(db.collection('users').doc(ret.buyerId)),
  ])
  if (!subOrderSnapshot.exists) throw new HttpsError('failed-precondition', 'subOrder_not_found')
  if (!orderSnapshot.exists) throw new HttpsError('failed-precondition', 'order_not_found')
  const subOrder = subOrderSchema.parse({ id: subOrderSnapshot.id, ...subOrderSnapshot.data() })
  const order = orderSchema.parse({ id: orderSnapshot.id, ...orderSnapshot.data() })
  const item = subOrder.items.find((line) => line.listingId === ret.listingId)
  if (!item) throw new HttpsError('failed-precondition', 'item_not_in_suborder')
  const buyerLanguage = buyerSnapshot.exists && buyerSnapshot.data()?.preferredLanguage === 'hi' ? 'hi' : 'en'

  if (ret.resolutionPreference === 'refund') {
    if (order.paymentMethod === 'cod' && order.paymentStatus === 'paid') {
      const bankDetailSnapshot = await tx.get(
        db.collection('refundBankDetails').where('returnId', '==', ret.id).where('status', '==', 'pending').limit(1),
      )
      if (bankDetailSnapshot.empty) throw new HttpsError('failed-precondition', 'bank_details_required')
    }

    const baseRefundPaise = computeLineRefund(item, ret.qty).totalPaise
    const deductionPaise = ret.sellerFault === false ? (ret.returnShippingDeductionPaise ?? 0) : 0
    const refundAmountPaise = Math.max(0, baseRefundPaise - deductionPaise)

    restoreStockInTx(tx, db, [{ listingId: ret.listingId, qty: ret.qty }], now, {
      sellerId: ret.sellerId,
      reason: 'return',
      actorId: actor.id,
      referenceId: ret.id,
    })
    tx.update(subOrderRef, {
      status: 'returned',
      timeline: appendTimelineEntry(subOrder.timeline, 'returned', actor, undefined, now),
      updatedAt: now,
    })
    tx.update(
      returnRef,
      stripUndefined({
        status: 'refunded',
        qc,
        refundAmountPaise,
        resolvedAt: now,
        timeline: appendTimelineEntry(ret.timeline, 'refunded', actor, qc.note, now),
        updatedAt: now,
      }),
    )
    queueNotification(tx, db, {
      userId: ret.buyerId,
      type: 'return_refunded',
      language: buyerLanguage,
      orderId: ret.orderId,
      subOrderId: ret.subOrderId,
      returnId: ret.id,
    })

    return {
      orderId: ret.orderId,
      subOrderId: ret.subOrderId,
      listingId: ret.listingId,
      qty: ret.qty,
      resolutionPreference: 'refund',
      refundAmountPaise,
    }
  }

  // resolutionPreference === 'replacement'
  restoreStockInTx(tx, db, [{ listingId: ret.listingId, qty: ret.qty }], now, {
    sellerId: ret.sellerId,
    reason: 'return',
    actorId: actor.id,
    referenceId: ret.id,
  })
  tx.update(db.collection('listings').doc(ret.listingId), {
    stockQty: FieldValue.increment(-ret.qty),
    updatedAt: now,
  })
  tx.set(db.collection('stockLedger').doc(), {
    listingId: ret.listingId,
    sellerId: ret.sellerId,
    deltaQty: -ret.qty,
    reason: 'replacement',
    actorId: actor.id,
    referenceId: ret.id,
    createdAt: now,
  })

  const replacementSubOrderRef = db.collection('subOrders').doc()
  const { id: _replacementId, ...replacementSubOrderDoc } = subOrderSchema.parse({
    id: replacementSubOrderRef.id,
    orderId: order.id,
    buyerId: ret.buyerId,
    sellerId: ret.sellerId,
    status: 'pending',
    purchasedPartIds: [item.partId],
    shippingAddress: subOrder.shippingAddress,
    items: [{ ...item, qty: ret.qty, unitPricePaise: 0, lineSubtotalPaise: 0, lineDiscountPaise: 0, lineTaxPaise: 0, lineTotalPaise: 0 }],
    subtotalPaise: 0,
    discountPaise: 0,
    taxPaise: 0,
    shippingPaise: 0,
    totalPaise: 0,
    isInterState: subOrder.isInterState,
    cgstPaise: 0,
    sgstPaise: 0,
    igstPaise: 0,
    timeline: appendTimelineEntry([], 'pending', actor, `Replacement for return ${ret.id}`, now),
    isReplacement: true,
    replacementForSubOrderId: subOrder.id,
    originReturnId: ret.id,
    createdAt: now,
    updatedAt: now,
  })
  tx.set(replacementSubOrderRef, stripUndefined(replacementSubOrderDoc))
  tx.update(orderRef, {
    subOrderIds: FieldValue.arrayUnion(replacementSubOrderRef.id),
    updatedAt: now,
  })
  tx.update(
    returnRef,
    stripUndefined({
      status: 'replaced',
      qc,
      replacementSubOrderId: replacementSubOrderRef.id,
      resolvedAt: now,
      timeline: appendTimelineEntry(ret.timeline, 'replaced', actor, qc.note, now),
      updatedAt: now,
    }),
  )
  queueNotification(tx, db, {
    userId: ret.buyerId,
    type: 'return_replaced',
    language: buyerLanguage,
    orderId: ret.orderId,
    subOrderId: replacementSubOrderRef.id,
    returnId: ret.id,
  })

  return {
    orderId: ret.orderId,
    subOrderId: ret.subOrderId,
    listingId: ret.listingId,
    qty: ret.qty,
    resolutionPreference: 'replacement',
    replacementSubOrderId: replacementSubOrderRef.id,
  }
}
