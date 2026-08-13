import { FieldValue } from 'firebase-admin/firestore'
import type { DocumentReference, Firestore, Transaction } from 'firebase-admin/firestore'

export interface FyGrossSalesRead {
  ref: DocumentReference
  /** This seller's cumulative gross sale value (ex-GST) recorded in `financialYear`, *before* the transaction currently being processed. */
  cumulativeBeforePaise: number
}

/** Read-phase: fetches a seller's running FY gross-sales total — the input `computeTds` (pricing/tax.ts) needs to test the individual/HUF exemption threshold. One doc per seller per financial year, `sellerFyGrossSales/{sellerId}_{financialYear}`. */
export async function readFyGrossSales(
  tx: Transaction,
  db: Firestore,
  sellerId: string,
  financialYear: string,
): Promise<FyGrossSalesRead> {
  const ref = db.collection('sellerFyGrossSales').doc(`${sellerId}_${financialYear}`)
  const snapshot = await tx.get(ref)
  const cumulativeBeforePaise = snapshot.exists
    ? ((snapshot.data()?.cumulativeGrossSaleExGstPaise as number | undefined) ?? 0)
    : 0
  return { ref, cumulativeBeforePaise }
}

/** Write-phase: adds this transaction's gross sale value to the running FY total. */
export function commitFyGrossSales(
  tx: Transaction,
  read: FyGrossSalesRead,
  sellerId: string,
  financialYear: string,
  addedGrossSaleExGstPaise: number,
  now: number,
): void {
  tx.set(
    read.ref,
    {
      sellerId,
      financialYear,
      cumulativeGrossSaleExGstPaise: FieldValue.increment(addedGrossSaleExGstPaise),
      updatedAt: now,
    },
    { merge: true },
  )
}
