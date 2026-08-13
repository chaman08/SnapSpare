import { orderSchema, subOrderSchema } from '@snapspare/shared'
import { type DocumentReference, FieldValue, getFirestore } from 'firebase-admin/firestore'

export type ReservationReleaseReason = 'gateway_error' | 'reservation_expired' | 'payment_failed'

/**
 * Releases a `pending_payment` order's stock reservation (decrements
 * `reservedStock` back down, never touches `stockQty` — nothing was ever
 * committed) and marks the order + its subOrders `cancelled`. Used by
 * createOrder's gateway-failure compensation path and by
 * releaseExpiredReservations' abandonment sweep.
 *
 * Idempotent and safe to race against the webhook: re-reads the order
 * inside the transaction and no-ops if it's no longer `pending_payment`
 * (already confirmed by a payment that landed in the meantime, or already
 * released by a previous call).
 */
export async function releaseReservationAndCancel(orderId: string, reason: ReservationReleaseReason): Promise<void> {
  const db = getFirestore()
  const orderRef = db.collection('orders').doc(orderId)

  await db.runTransaction(async (tx) => {
    const orderSnapshot = await tx.get(orderRef)
    if (!orderSnapshot.exists) return
    const order = orderSchema.parse({ id: orderSnapshot.id, ...orderSnapshot.data() })
    if (order.status !== 'pending_payment') return

    const subOrderRefs = order.subOrderIds.map((id) => db.collection('subOrders').doc(id))
    const subOrderSnapshots = await Promise.all(subOrderRefs.map((ref) => tx.get(ref)))

    const releases: Array<{ ref: DocumentReference; qty: number }> = []
    for (const snapshot of subOrderSnapshots) {
      if (!snapshot.exists) continue
      const subOrder = subOrderSchema.parse({ id: snapshot.id, ...snapshot.data() })
      for (const item of subOrder.items) {
        releases.push({ ref: db.collection('listings').doc(item.listingId), qty: item.qty })
      }
    }

    const now = Date.now()
    for (const { ref, qty } of releases) {
      tx.update(ref, { reservedStock: FieldValue.increment(-qty), updatedAt: now })
    }
    for (const snapshot of subOrderSnapshots) {
      if (!snapshot.exists) continue
      tx.update(snapshot.ref, { status: 'cancelled', updatedAt: now })
    }
    tx.update(orderRef, {
      status: 'cancelled',
      paymentStatus: 'failed',
      cancelledReason: reason,
      updatedAt: now,
    })
  })
}
