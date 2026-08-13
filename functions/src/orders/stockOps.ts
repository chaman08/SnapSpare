import type { StockAdjustReason } from '@snapspare/shared'
import { FieldValue, type Firestore, type Transaction } from 'firebase-admin/firestore'
import { stripUndefined } from '../util/stripUndefined.js'

export interface StockLine {
  listingId: string
  qty: number
}

export interface RestoreStockOptions {
  sellerId: string
  reason: StockAdjustReason
  actorId?: string
  /** subOrderId/returnId this movement was posted from, for cross-reference in the stock ledger view. */
  referenceId?: string
}

/**
 * Restores `qty` units of sellable stock for each line, atomically, inside
 * the caller's transaction. Only ever `stockQty` — by the time a subOrder is
 * actionable (order confirmed) its stock was already converted from
 * "reserved" to "committed" (see checkout/paymentTransition.ts's
 * applyPaymentCaptured / checkout/createOrder.ts's immediate-confirm path),
 * so `reservedStock` for these items is already back at 0 and never touched
 * here. Used by cancelSubOrder, rejectSubOrder, autoCancelUnacceptedSubOrders,
 * refundReturn, and processRtoRefund — the places sellable inventory is
 * handed back. Also appends a `stockLedger` entry per line (requirement 5's
 * stock ledger view) — `balanceAfter` is deliberately omitted here (unlike
 * `adjustStock.ts`'s manual path): these are `FieldValue.increment()` writes
 * without a prior read, and reordering five payment-critical transactions'
 * read/write sequencing just to populate one display field wasn't worth the
 * blast radius (see stockLedgerEntrySchema's header comment).
 */
export function restoreStockInTx(
  tx: Transaction,
  db: Firestore,
  lines: StockLine[],
  now: number,
  options: RestoreStockOptions,
): void {
  for (const line of lines) {
    tx.update(db.collection('listings').doc(line.listingId), {
      stockQty: FieldValue.increment(line.qty),
      updatedAt: now,
    })
    tx.set(
      db.collection('stockLedger').doc(),
      stripUndefined({
        listingId: line.listingId,
        sellerId: options.sellerId,
        deltaQty: line.qty,
        reason: options.reason,
        actorId: options.actorId,
        referenceId: options.referenceId,
        createdAt: now,
      }),
    )
  }
}
