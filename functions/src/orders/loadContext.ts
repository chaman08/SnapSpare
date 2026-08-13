import { type Order, orderSchema, type SubOrder, subOrderSchema } from '@snapspare/shared'
import type { DocumentReference, Firestore, Transaction } from 'firebase-admin/firestore'
import { HttpsError } from 'firebase-functions/v2/https'
import type { NotificationLanguage } from './notify.js'

export interface SubOrderContext {
  subOrderRef: DocumentReference
  subOrder: SubOrder
  orderRef: DocumentReference
  order: Order
  buyerLanguage: NotificationLanguage
}

/**
 * Shared read step for every subOrder-transition callable: loads the
 * subOrder, its parent order, and the buyer's notification-copy language, in
 * one place so every transition function validates the same invariant the
 * same way — the order must actually be paid for (not `pending_payment`,
 * where subOrders exist but the seller has nothing to act on yet) and not
 * already cancelled/refunded outright. All reads happen before any writes,
 * as required inside a Firestore transaction — callers do their own
 * status-specific checks (e.g. "must currently be 'pending'") afterwards.
 */
export async function loadSubOrderContext(
  tx: Transaction,
  db: Firestore,
  subOrderId: string,
): Promise<SubOrderContext> {
  const subOrderRef = db.collection('subOrders').doc(subOrderId)
  const subOrderSnapshot = await tx.get(subOrderRef)
  if (!subOrderSnapshot.exists) throw new HttpsError('not-found', 'subOrder_not_found')
  const subOrder = subOrderSchema.parse({ id: subOrderSnapshot.id, ...subOrderSnapshot.data() })

  const orderRef = db.collection('orders').doc(subOrder.orderId)
  const [orderSnapshot, buyerSnapshot] = await Promise.all([
    tx.get(orderRef),
    tx.get(db.collection('users').doc(subOrder.buyerId)),
  ])
  if (!orderSnapshot.exists) throw new HttpsError('failed-precondition', 'order_not_found')
  const order = orderSchema.parse({ id: orderSnapshot.id, ...orderSnapshot.data() })

  if (order.status === 'pending_payment' || order.status === 'cancelled' || order.status === 'refunded') {
    throw new HttpsError('failed-precondition', 'order_not_actionable')
  }

  const preferredLanguage = buyerSnapshot.exists ? buyerSnapshot.data()?.preferredLanguage : undefined
  const buyerLanguage: NotificationLanguage = preferredLanguage === 'hi' ? 'hi' : 'en'

  return { subOrderRef, subOrder, orderRef, order, buyerLanguage }
}
