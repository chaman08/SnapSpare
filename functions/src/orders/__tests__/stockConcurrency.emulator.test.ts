import { randomUUID } from 'node:crypto'
import { initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { describe, expect, it } from 'vitest'

process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080'

initializeApp({ projectId: 'demo-snapspare' })
const db = getFirestore()

/**
 * Exercises the exact "read stockQty/reservedStock inside a transaction,
 * verify available >= qty, then write" pattern used throughout order
 * placement (checkout/createOrder.ts), payment capture
 * (checkout/paymentTransition.ts), and Phase 9's stock-restoring
 * cancellation/return paths (orders/stockOps.ts, used by cancelSubOrder.ts,
 * autoCancelUnacceptedSubOrders.ts and refundReturn.ts) — proving it never
 * oversells even when two buyers race for the very last unit, and that a
 * concurrent stock *restore* (a cancellation) never gets lost when it lands
 * mid-race with a concurrent purchase attempt.
 *
 * Run with `pnpm test:emulator` (wraps this in `firebase emulators:exec`,
 * same as `pnpm test:rules` does for the security-rules suite) — not part
 * of the plain `pnpm test` used in CI, since that has no Firestore emulator
 * running.
 */

async function purchaseLastUnit(listingId: string, qty: number): Promise<'purchased' | 'insufficient_stock'> {
  return db.runTransaction(async (tx) => {
    const ref = db.collection('listings').doc(listingId)
    const snapshot = await tx.get(ref)
    const data = snapshot.data() as { stockQty: number; reservedStock: number }
    const available = data.stockQty - data.reservedStock
    if (available < qty) return 'insufficient_stock'
    tx.update(ref, { stockQty: FieldValue.increment(-qty) })
    return 'purchased'
  })
}

async function restoreStock(listingId: string, qty: number): Promise<void> {
  await db.runTransaction(async (tx) => {
    const ref = db.collection('listings').doc(listingId)
    await tx.get(ref) // all reads must precede all writes inside a Firestore transaction
    tx.update(ref, { stockQty: FieldValue.increment(qty) })
  })
}

function freshListingId(): string {
  return `listing-${randomUUID()}`
}

describe('stock transaction concurrency', () => {
  it('never lets two concurrent buyers both win the last unit', async () => {
    const id = freshListingId()
    await db.collection('listings').doc(id).set({ stockQty: 1, reservedStock: 0 })

    const results = await Promise.all([purchaseLastUnit(id, 1), purchaseLastUnit(id, 1)])

    expect(results.filter((r) => r === 'purchased')).toHaveLength(1)
    expect(results.filter((r) => r === 'insufficient_stock')).toHaveLength(1)

    const finalSnapshot = await db.collection('listings').doc(id).get()
    expect(finalSnapshot.data()?.stockQty).toBe(0)
  })

  it('keeps stockQty exact when a cancellation restore races a concurrent purchase attempt', async () => {
    const id = freshListingId()
    // Starts sold out — a cancellation is about to free the unit back up
    // right as a second buyer tries to buy it.
    await db.collection('listings').doc(id).set({ stockQty: 0, reservedStock: 0 })

    const [purchaseOutcome] = await Promise.all([purchaseLastUnit(id, 1), restoreStock(id, 1)])

    const finalSnapshot = await db.collection('listings').doc(id).get()
    const finalStock = finalSnapshot.data()?.stockQty as number

    // Whichever order Firestore serializes the two transactions in, the
    // arithmetic must land exactly here — no lost update, no phantom
    // double-credit, regardless of which one "won" the race.
    if (purchaseOutcome === 'purchased') {
      expect(finalStock).toBe(0) // restored to 1, then immediately bought back down to 0
    } else {
      expect(finalStock).toBe(1) // purchase saw 0 available and bailed; only the restore landed
    }
  })

  it('never oversells across several concurrent buyers for a small batch of stock', async () => {
    const id = freshListingId()
    const STOCK = 3
    // Kept modest rather than dozens-wide: the Firestore emulator's
    // transaction retry budget (unlike production Firestore) isn't tuned
    // for very high single-document contention, and that's an emulator
    // characteristic, not a property of the reserve/commit/restore
    // transaction pattern under test here.
    const BUYERS = 6
    await db.collection('listings').doc(id).set({ stockQty: STOCK, reservedStock: 0 })

    const outcomes = await Promise.all(Array.from({ length: BUYERS }, () => purchaseLastUnit(id, 1)))

    expect(outcomes.filter((outcome) => outcome === 'purchased')).toHaveLength(STOCK)
    const finalSnapshot = await db.collection('listings').doc(id).get()
    expect(finalSnapshot.data()?.stockQty).toBe(0)
  })
})
