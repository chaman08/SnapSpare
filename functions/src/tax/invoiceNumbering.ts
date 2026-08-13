import type { Seller } from '@snapspare/shared'
import type { DocumentReference, Firestore, Transaction } from 'firebase-admin/firestore'

const SEQUENCE_DIGITS = 6

/** Sanitises `seller.sellerCode` (or derives a fallback from the seller id, for sellers onboarded before this field existed) into an invoice-number-safe, uppercase, alphanumeric segment. */
export function resolveSellerInvoiceCode(seller: Pick<Seller, 'id' | 'sellerCode'>): string {
  const raw = seller.sellerCode ?? seller.id
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
  return (cleaned.length > 0 ? cleaned : 'SELLER').slice(0, 12)
}

export type DocumentKind = 'invoice' | 'creditNote'

const COUNTER_COLLECTION: Record<DocumentKind, string> = {
  invoice: 'invoiceCounters',
  creditNote: 'creditNoteCounters',
}

export interface PendingSequence {
  counterRef: DocumentReference
  sequence: number
}

/**
 * Read-phase half of allocating a sequential invoice/credit-note number:
 * reads the counter doc (`invoiceCounters/{sellerId}_{financialYear}` or
 * the credit-note equivalent — its own, independent sequence, design brief
 * item 5) and returns the next sequence value, without writing anything.
 * Split from `commitSequence` below because Firestore transactions require
 * every read to happen before any write — callers that also read other
 * documents (subOrder, order, seller...) must call this alongside those
 * reads, then call `commitSequence` only once every read is done.
 */
export async function readNextSequence(
  tx: Transaction,
  db: Firestore,
  kind: DocumentKind,
  sellerId: string,
  financialYear: string,
): Promise<PendingSequence> {
  const counterRef = db.collection(COUNTER_COLLECTION[kind]).doc(`${sellerId}_${financialYear}`)
  const snapshot = await tx.get(counterRef)
  const previous = snapshot.exists ? ((snapshot.data()?.lastNumber as number | undefined) ?? 0) : 0
  return { counterRef, sequence: previous + 1 }
}

/**
 * Write-phase half: persists the sequence bumped by `readNextSequence`.
 * Firestore transactions serialize conflicting writes to the same counter
 * doc rather than racing, so two subOrders shipping for the same seller in
 * the same millisecond can never be handed the same number.
 */
export function commitSequence(
  tx: Transaction,
  pending: PendingSequence,
  sellerId: string,
  financialYear: string,
  now: number,
): void {
  tx.set(
    pending.counterRef,
    { sellerId, financialYear, lastNumber: pending.sequence, updatedAt: now },
    { merge: true },
  )
}

/** Formats the allocated sequence into the invoice/credit-note number shown to buyers and filed with GST returns: `SELLERCODE/FY26-27/000123` for a tax invoice, `SELLERCODE/CN-FY26-27/000045` for a credit note. */
export function formatDocumentNumber(kind: DocumentKind, sellerCode: string, financialYear: string, sequence: number): string {
  const yearSegment = kind === 'invoice' ? financialYear : `CN-${financialYear}`
  return `${sellerCode}/${yearSegment}/${String(sequence).padStart(SEQUENCE_DIGITS, '0')}`
}
