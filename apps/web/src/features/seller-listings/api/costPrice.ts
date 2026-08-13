import type { CostPrivate } from '@snapspare/shared'
import { costPrivateSchema } from '@snapspare/shared'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

/**
 * Direct rules-guarded read/write of `listings/{id}/private/cost` (see
 * firestore.rules — gated by hasSellerPermission on the parent listing's
 * sellerId). No callable needed: unlike listing pricing, a single
 * costPricePaise field has no cross-field invariant to enforce server-side,
 * so this follows sellerSettingsActions.ts's direct-write precedent rather
 * than adding a callable purely for consistency.
 */
export async function getListingCostPrice(listingId: string): Promise<CostPrivate | null> {
  const snapshot = await getDoc(doc(db, 'listings', listingId, 'private', 'cost'))
  if (!snapshot.exists()) return null
  return costPrivateSchema.parse(snapshot.data())
}

export async function setListingCostPrice(listingId: string, costPricePaise: number): Promise<void> {
  await setDoc(doc(db, 'listings', listingId, 'private', 'cost'), {
    costPricePaise,
    updatedAt: Date.now(),
  })
}
