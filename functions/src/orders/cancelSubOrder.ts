import {
  CANCELLABLE_SUB_ORDER_STATUSES,
  cancelSubOrderRequestSchema,
  type SubOrderActionResult,
  type SubOrderItem,
} from '@snapspare/shared'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { loadSubOrderContext } from './loadContext.js'
import { queueNotification } from './notify.js'
import { restoreStockInTx } from './stockOps.js'
import { appendTimelineEntry } from './timeline.js'
import { executeRefund } from '../payments/refundEngine.js'
import { provider } from '../shipping/provider.js'

/**
 * Buyer- or seller-initiated cancellation of a not-yet-shipped subOrder:
 * {pending, accepted, packed} -> `cancelled`. Restores the stock committed
 * at order confirmation, atomically, in the same transaction as the status
 * write (see stockOps.ts's restoreStockInTx doc comment for why only
 * `stockQty` and never `reservedStock` needs touching here). Refunds the
 * full subOrder via functions/src/payments/refundEngine.ts once the
 * transaction commits (best-effort, same two-phase shape as
 * shipping/processRtoRefund.ts — an external gateway call must never run
 * inside a transaction that might retry).
 */
export const cancelSubOrder = onCall({ enforceAppCheck: true, region: 'asia-south1' }, async (request): Promise<SubOrderActionResult> => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required')
  const uid = request.auth.uid
  const sellerId = request.auth.token.sellerId as string | undefined

  const parsed = cancelSubOrderRequestSchema.safeParse(request.data)
  if (!parsed.success) throw new HttpsError('invalid-argument', 'A valid subOrderId is required')

  const db = getFirestore()
  let bookedProviderShipmentId: string | undefined
  let orderId: string | undefined
  let refundItems: SubOrderItem[] = []

  const result = await db.runTransaction(async (tx) => {
    const ctx = await loadSubOrderContext(tx, db, parsed.data.subOrderId)
    bookedProviderShipmentId = ctx.subOrder.shipment?.providerShipmentId
    orderId = ctx.order.id
    refundItems = ctx.subOrder.items

    const isBuyer = ctx.subOrder.buyerId === uid
    const isSeller = sellerId !== undefined && ctx.subOrder.sellerId === sellerId
    if (!isBuyer && !isSeller) throw new HttpsError('permission-denied', 'not_a_participant')
    if (!CANCELLABLE_SUB_ORDER_STATUSES.includes(ctx.subOrder.status)) {
      throw new HttpsError('failed-precondition', 'invalid_transition')
    }

    const now = Date.now()
    restoreStockInTx(
      tx,
      db,
      ctx.subOrder.items.map((item) => ({ listingId: item.listingId, qty: item.qty })),
      now,
      {
        sellerId: ctx.subOrder.sellerId,
        reason: 'correction',
        actorId: isBuyer ? uid : sellerId,
        referenceId: ctx.subOrder.id,
      },
    )
    tx.update(ctx.subOrderRef, {
      status: 'cancelled',
      slaAcceptByAt: FieldValue.delete(),
      timeline: appendTimelineEntry(
        ctx.subOrder.timeline,
        'cancelled',
        { type: isBuyer ? 'buyer' : 'seller', id: isBuyer ? uid : sellerId },
        parsed.data.reason,
        now,
      ),
      updatedAt: now,
    })

    // Notify whichever side didn't take the action — the actor already knows.
    const notifyUserId = isBuyer ? undefined : ctx.subOrder.buyerId
    if (notifyUserId) {
      queueNotification(tx, db, {
        userId: notifyUserId,
        type: 'suborder_cancelled',
        language: ctx.buyerLanguage,
        orderId: ctx.order.id,
        subOrderId: ctx.subOrder.id,
        copyInput: { reason: parsed.data.reason },
      })
    }

    return { subOrderId: ctx.subOrder.id, status: 'cancelled' as const }
  })

  // Best-effort — a cancelled subOrder should never fail to cancel because
  // the courier's API happened to be down; cancelShipment.ts (the seller-
  // facing callable) remains available to retry this manually if needed.
  if (bookedProviderShipmentId) {
    try {
      await provider.cancelShipment(bookedProviderShipmentId)
    } catch (error) {
      logger.warn('cancelSubOrder: best-effort provider.cancelShipment failed', {
        subOrderId: result.subOrderId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  if (orderId) {
    try {
      await executeRefund({
        orderId,
        subOrderId: result.subOrderId,
        items: refundItems.map((item) => ({ listingId: item.listingId, qty: item.qty })),
        reason: 'cancellation',
      })
    } catch (error) {
      logger.error('cancelSubOrder: refund failed', {
        subOrderId: result.subOrderId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return result
})
