import { type OrderStatus, orderSchema, type SubOrderStatus, subOrderSchema } from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import { onDocumentWritten } from 'firebase-functions/v2/firestore'
import { appendTimelineEntry } from './timeline.js'

/** subOrder statuses that never contribute a "the order is still moving" signal to the aggregate — the item was never fulfilled. */
const TERMINAL_UNFULFILLED: SubOrderStatus[] = ['cancelled', 'rejected', 'refunded']

/**
 * Rolls a parent order's `status` up from its subOrders' statuses. Only
 * subOrders that were actually fulfilled (i.e. not cancelled/rejected/
 * refunded) count toward "how far along is this order" — an order with one
 * cancelled seller and one delivered seller still reads as 'delivered', not
 * stuck at 'partially_shipped' forever. An order whose subOrders are *all*
 * cancelled/refunded is itself cancelled/refunded.
 */
export function computeAggregateOrderStatus(subStatuses: SubOrderStatus[]): OrderStatus {
  const active = subStatuses.filter((status) => !TERMINAL_UNFULFILLED.includes(status))

  if (active.length === 0) {
    return subStatuses.includes('refunded') ? 'refunded' : 'cancelled'
  }
  if (active.every((status) => status === 'delivered' || status === 'returned')) {
    return 'delivered'
  }
  if (active.every((status) => status === 'shipped' || status === 'out_for_delivery')) {
    return 'shipped'
  }
  if (active.some((status) => ['shipped', 'out_for_delivery', 'delivered', 'returned'].includes(status))) {
    return 'partially_shipped'
  }
  if (active.some((status) => status === 'packed')) {
    return 'processing'
  }
  return 'confirmed'
}

/**
 * Fires on every subOrder write, recomputes its parent order's aggregate
 * status inside a transaction (so two sibling subOrders transitioning near-
 * simultaneously never race each other onto a stale order.status), and
 * appends one order-level timeline entry when the aggregate actually
 * changes. Skips orders still `pending_payment` — no subOrder should be
 * transitioning while the order itself is unpaid (enforced by
 * loadSubOrderContext), but this stays defensive in case of a bug elsewhere.
 */
export const onSubOrderStatusChange = onDocumentWritten(
  { document: 'subOrders/{subOrderId}', region: 'asia-south1' },
  async (event) => {
    const before = event.data?.before.exists ? event.data.before.data() : undefined
    const after = event.data?.after.exists ? event.data.after.data() : undefined
    if (!after || before?.status === after.status) return

    const orderId = after.orderId as string | undefined
    if (!orderId) return

    const db = getFirestore()
    const orderRef = db.collection('orders').doc(orderId)

    await db.runTransaction(async (tx) => {
      const orderSnapshot = await tx.get(orderRef)
      if (!orderSnapshot.exists) return
      const orderParsed = orderSchema.safeParse({ id: orderSnapshot.id, ...orderSnapshot.data() })
      if (!orderParsed.success) {
        logger.error('onSubOrderStatusChange: order doc failed schema validation', {
          orderId,
          issues: orderParsed.error.issues,
        })
        return
      }
      const order = orderParsed.data
      if (order.status === 'pending_payment') return

      const siblingRefs = order.subOrderIds.map((id) => db.collection('subOrders').doc(id))
      const siblingSnapshots = await Promise.all(siblingRefs.map((ref) => tx.get(ref)))
      const statuses: SubOrderStatus[] = []
      for (const snapshot of siblingSnapshots) {
        if (!snapshot.exists) continue
        const parsed = subOrderSchema.safeParse({ id: snapshot.id, ...snapshot.data() })
        if (!parsed.success) {
          logger.error('onSubOrderStatusChange: subOrder doc failed schema validation', {
            subOrderId: snapshot.id,
            issues: parsed.error.issues,
          })
          continue
        }
        statuses.push(parsed.data.status)
      }
      if (statuses.length === 0) return

      const nextStatus = computeAggregateOrderStatus(statuses)
      if (nextStatus === order.status) return

      const now = Date.now()
      const update: Record<string, unknown> = {
        status: nextStatus,
        timeline: appendTimelineEntry(order.timeline, nextStatus, { type: 'system' }, undefined, now),
        updatedAt: now,
      }
      if (nextStatus === 'cancelled' && order.cancelledReason === undefined) {
        update.cancelledReason = 'all_subOrders_cancelled'
      }
      tx.update(orderRef, update)
    })
  },
)
