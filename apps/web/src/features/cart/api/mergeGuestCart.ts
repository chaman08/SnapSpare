import type { Cart, CartItem, CartSellerGroup } from '@snapspare/shared'
import {
  cartConverter,
  listingConverter,
  listingIdSchema,
  partIdSchema,
  sellerIdSchema,
  userIdSchema,
} from '@snapspare/shared'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'
import { useGuestCartStore } from '@/stores/guestCartStore'

/**
 * Merges the signed-out guest cart (localStorage) into the buyer's Firestore
 * cart on sign-in: dedupes by listingId (summing quantities) and caps each
 * line at the listing's current stock, since stock may have moved since the
 * item was added while signed out. Clears the guest cart once merged.
 */
/** Merges one flat guest-item list into a seller-grouped map, capping quantity at live stock and preferring the earliest `addedAt`. Shared by the active-cart and saved-for-later merges below — both follow the identical dedupe/cap rule. */
async function mergeGuestItemsInto(
  existingGroups: CartSellerGroup[],
  guestItems: Array<CartItem>,
): Promise<CartSellerGroup[]> {
  const bySellerAndListing = new Map<string, Map<string, CartItem>>()

  for (const group of existingGroups) {
    const listingMap = bySellerAndListing.get(group.sellerId) ?? new Map<string, CartItem>()
    for (const item of group.items) listingMap.set(item.listingId, item)
    bySellerAndListing.set(group.sellerId, listingMap)
  }

  for (const guestItem of guestItems) {
    const listingSnapshot = await getDoc(
      doc(db, 'listings', guestItem.listingId).withConverter(clientConverter(listingConverter)),
    )
    if (!listingSnapshot.exists()) continue // listing removed/unpublished since it was added
    const listing = listingSnapshot.data()

    const listingMap = bySellerAndListing.get(guestItem.sellerId) ?? new Map<string, CartItem>()
    const already = listingMap.get(guestItem.listingId)
    const combinedQty = (already?.qty ?? 0) + guestItem.qty
    const cappedQty = Math.min(combinedQty, listing.stockQty)

    if (cappedQty > 0) {
      listingMap.set(guestItem.listingId, {
        listingId: listingIdSchema.parse(guestItem.listingId),
        partId: partIdSchema.parse(guestItem.partId),
        sellerId: sellerIdSchema.parse(guestItem.sellerId),
        qty: cappedQty,
        unitPricePaise: guestItem.unitPricePaise,
        tierMinQtyApplied: guestItem.tierMinQtyApplied,
        addedAt: already?.addedAt ?? guestItem.addedAt,
      })
    }
    bySellerAndListing.set(guestItem.sellerId, listingMap)
  }

  return Array.from(bySellerAndListing.entries())
    .map(([sellerId, listingMap]) => ({
      sellerId: sellerIdSchema.parse(sellerId),
      items: Array.from(listingMap.values()),
    }))
    .filter((group) => group.items.length > 0)
}

export async function mergeGuestCartIntoFirestore(rawUserId: string): Promise<void> {
  const guestState = useGuestCartStore.getState()
  const guestItems = guestState.items
  const guestSavedItems = guestState.savedItems
  if (guestItems.length === 0 && guestSavedItems.length === 0) return

  const userId = userIdSchema.parse(rawUserId)
  const cartRef = doc(db, 'carts', userId).withConverter(clientConverter(cartConverter))
  const existingSnapshot = await getDoc(cartRef)
  const existing: Cart | undefined = existingSnapshot.exists() ? existingSnapshot.data() : undefined

  const sellerGroups = await mergeGuestItemsInto(existing?.sellerGroups ?? [], guestItems)
  // savedItems has no sellerGroups wrapper on the schema — reuse the same
  // grouping helper, then flatten straight back out.
  const savedGroups = await mergeGuestItemsInto(
    (existing?.savedItems ?? []).map((item) => ({ sellerId: item.sellerId, items: [item] })),
    guestSavedItems,
  )
  const savedItems = savedGroups.flatMap((group) => group.items)

  const now = Date.now()
  await setDoc(cartRef, {
    id: userId,
    userId,
    sellerGroups,
    savedItems,
    couponCode: existing?.couponCode,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  })

  useGuestCartStore.getState().clear()
  useGuestCartStore.setState({ savedItems: [] })
}
