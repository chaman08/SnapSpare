import type { Ledger, LedgerEntryReferenceType, LedgerEntryType } from '@snapspare/shared'
import type { DocumentReference, Firestore, Transaction } from 'firebase-admin/firestore'

/** One ledger per seller, deterministic doc id (== sellerId) — see schemas/ledger.ts's doc comment. */
export function ledgerRefForSeller(db: Firestore, sellerId: string): DocumentReference {
  return db.collection('ledgers').doc(sellerId)
}

export interface LedgerReadResult {
  ledgerRef: DocumentReference
  currentBalancePaise: number
  exists: boolean
}

/** Read-phase: fetches the seller's ledger (or a zero-balance stand-in if it doesn't exist yet — the ledger doc is created lazily on its first entry). Call before any transaction writes, alongside every other read. */
export async function readLedger(tx: Transaction, db: Firestore, sellerId: string): Promise<LedgerReadResult> {
  const ledgerRef = ledgerRefForSeller(db, sellerId)
  const snapshot = await tx.get(ledgerRef)
  const currentBalancePaise = snapshot.exists ? ((snapshot.data()?.currentBalancePaise as number | undefined) ?? 0) : 0
  return { ledgerRef, currentBalancePaise, exists: snapshot.exists }
}

export interface LedgerEntryInput {
  type: LedgerEntryType
  direction: 'credit' | 'debit'
  amountPaise: number
  referenceType?: LedgerEntryReferenceType
  referenceId?: string
  description?: string
}

/**
 * Write-phase: applies one or more entries to a seller's ledger balance and
 * appends each as its own `ledgers/{ledgerId}/entries/{entryId}` doc
 * (running-balance audit trail — see schemas/ledger.ts). `amountPaise` of 0
 * is skipped (e.g. a composition-scheme seller's TCS is always 0 — no point
 * writing a no-op entry). Creates the parent ledger doc on first write via
 * `set(..., { merge: true })` rather than requiring a separate
 * "ensure ledger exists" step.
 *
 * A future payout Cloud Function reads `currentBalancePaise` as the amount
 * owed to the seller — every debit posted here (TCS, TDS, and eventually
 * commission) is already netted out of that balance by the time payout
 * runs, which is what "deduct at payout" means in this codebase: the
 * deduction happens now, payout just pays out what's left.
 */
export function postLedgerEntries(
  tx: Transaction,
  db: Firestore,
  read: LedgerReadResult,
  sellerId: string,
  entries: LedgerEntryInput[],
  now: number,
): void {
  let runningBalance = read.currentBalancePaise
  let lastEntryAt = read.exists ? undefined : now

  for (const entry of entries) {
    if (entry.amountPaise === 0) continue
    runningBalance += entry.direction === 'credit' ? entry.amountPaise : -entry.amountPaise
    lastEntryAt = now

    const entryRef = read.ledgerRef.collection('entries').doc()
    const entryDoc: Record<string, unknown> = {
      ledgerId: read.ledgerRef.id,
      type: entry.type,
      direction: entry.direction,
      amountPaise: entry.amountPaise,
      balanceAfterPaise: runningBalance,
      createdAt: now,
    }
    if (entry.referenceType !== undefined) entryDoc.referenceType = entry.referenceType
    if (entry.referenceId !== undefined) entryDoc.referenceId = entry.referenceId
    if (entry.description !== undefined) entryDoc.description = entry.description
    tx.set(entryRef, entryDoc)
  }

  const ledgerUpdate: Partial<Ledger> & Record<string, unknown> = {
    ownerType: 'seller',
    ownerId: sellerId,
    currentBalancePaise: runningBalance,
    updatedAt: now,
  }
  if (lastEntryAt !== undefined) ledgerUpdate.lastEntryAt = lastEntryAt
  if (!read.exists) ledgerUpdate.createdAt = now
  tx.set(read.ledgerRef, ledgerUpdate, { merge: true })
}
