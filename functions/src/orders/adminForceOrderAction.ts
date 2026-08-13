import {
  type AdminForceOrderActionResult,
  adminForceOrderActionRequestSchema,
  CANCELLABLE_SUB_ORDER_STATUSES,
  orderSchema,
  type SubOrderItem,
} from '@snapspare/shared'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { isAdminRequest } from './authz.js'
import { loadSubOrderContext } from './loadContext.js'
import { queueNotification } from './notify.js'
import { restoreStockInTx } from './stockOps.js'
import { appendTimelineEntry } from './timeline.js'
import { executeRefund } from '../payments/refundEngine.js'
import { writeAuditLog } from '../util/auditLog.js'

export const adminForceOrderAction = onCall(
  { enforceAppCheck: true, region: 'asia-south1' },
  async (request): Promise<AdminForceOrderActionResult> => {
    if (!request.auth || !isAdminRequest(request)) throw new HttpsError('permission-denied', 'admin_only')
    const adminUid = request.auth.uid

    const parsed = adminForceOrderActionRequestSchema.safeParse(request.data)
    if (!parsed.success) throw new HttpsError('invalid-argument', 'Invalid request')
    const input = parsed.data
    const db = getFirestore()

    if (input.action === 'forceStatus') {
      const ref = db.collection('orders').doc(input.orderId)
      const snapshot = await ref.get()
      if (!snapshot.exists) throw new HttpsError('not-found', 'order_not_found')
      const order = orderSchema.parse({ id: snapshot.id, ...snapshot.data() })

      const now = Date.now()
      await ref.update({
        status: input.status,
        timeline: [...order.timeline, { status: input.status, actor: { type: 'admin', id: adminUid }, note: input.reason, createdAt: now }],
        updatedAt: now,
      })
      await writeAuditLog({
        request,
        action: 'order.forceStatus',
        targetType: 'orders',
        targetId: order.id,
        before: { status: order.status },
        after: { status: input.status },
        note: input.reason,
      })
      return { ok: true }
    }

    if (input.action === 'forceCancelSubOrder') {
      let orderId: string | undefined
      let refundItems: SubOrderItem[] = []
      let previousStatus: string | undefined

      const result = await db.runTransaction(async (tx) => {
        const ctx = await loadSubOrderContext(tx, db, input.subOrderId)
        if (!CANCELLABLE_SUB_ORDER_STATUSES.includes(ctx.subOrder.status)) {
          throw new HttpsError('failed-precondition', 'subOrder_not_cancellable')
        }
        previousStatus = ctx.subOrder.status
        orderId = ctx.order.id
        refundItems = ctx.subOrder.items

        const now = Date.now()
        restoreStockInTx(
          tx,
          db,
          ctx.subOrder.items.map((item) => ({ listingId: item.listingId, qty: item.qty })),
          now,
          { sellerId: ctx.subOrder.sellerId, reason: 'correction', actorId: adminUid, referenceId: ctx.subOrder.id },
        )
        tx.update(ctx.subOrderRef, {
          status: 'cancelled',
          slaAcceptByAt: FieldValue.delete(),
          timeline: appendTimelineEntry(ctx.subOrder.timeline, 'cancelled', { type: 'admin', id: adminUid }, input.reason, now),
          updatedAt: now,
        })
        queueNotification(tx, db, {
          userId: ctx.subOrder.buyerId,
          type: 'suborder_cancelled',
          language: ctx.buyerLanguage,
          orderId: ctx.order.id,
          subOrderId: ctx.subOrder.id,
          copyInput: { reason: input.reason },
        })
        return { subOrderId: ctx.subOrder.id }
      })

      if (orderId) {
        try {
          await executeRefund({
            orderId,
            subOrderId: result.subOrderId,
            items: refundItems.map((item) => ({ listingId: item.listingId, qty: item.qty })),
            reason: 'cancellation',
          })
        } catch (error) {
          logger.error('adminForceOrderAction: forceCancelSubOrder refund failed', {
            subOrderId: result.subOrderId,
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }

      await writeAuditLog({
        request,
        action: 'subOrder.forceCancel',
        targetType: 'subOrders',
        targetId: result.subOrderId,
        before: { status: previousStatus },
        after: { status: 'cancelled' },
        note: input.reason,
      })
      return { ok: true }
    }

    // action === 'forceRefund'
    const subOrderSnapshot = await db.collection('subOrders').doc(input.subOrderId).get()
    if (!subOrderSnapshot.exists) throw new HttpsError('not-found', 'subOrder_not_found')
    const subOrderData = subOrderSnapshot.data()
    const items = ((subOrderData?.items as { listingId: string }[] | undefined) ?? []).map((item) => ({ listingId: item.listingId, qty: 1 }))
    if (items.length === 0) throw new HttpsError('failed-precondition', 'subOrder_has_no_items')

    await executeRefund({
      orderId: subOrderData?.orderId as string,
      subOrderId: input.subOrderId,
      items,
      reason: 'admin_adjustment',
      overrideAmountPaise: input.refundAmountPaise,
      ledgerEntryOverride: {
        type: 'refund_debit',
        referenceType: 'subOrder',
        referenceId: input.subOrderId,
        description: `Admin forced refund: ${input.reason}`,
      },
    })

    await writeAuditLog({
      request,
      action: 'subOrder.forceRefund',
      targetType: 'subOrders',
      targetId: input.subOrderId,
      after: { refundAmountPaise: input.refundAmountPaise },
      note: input.reason,
    })
    return { ok: true }
  },
)
