import type { SubOrder } from '@snapspare/shared'
import { subOrderConverter } from '@snapspare/shared'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { addItemToCart } from '@/features/cart/api/addToCart'
import { priceCart } from '@/features/cart/api/priceCart'
import { db } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

export interface ReorderChangedItem {
  title: string
  reason: 'unavailable' | 'price_changed'
}

export interface ReorderOutcome {
  addedCount: number
  changedItems: ReorderChangedItem[]
}

/**
 * "Reorder" (design item 3): re-adds every line from a delivered subOrder to
 * the cart, but never trusts the old snapshot — it re-prices every line
 * through the same server-authoritative priceCart callable checkout itself
 * uses first, so a since-changed price or a since-sold-out listing is
 * flagged back to the caller (for a toast) rather than silently added at a
 * stale price. Unavailable lines are skipped entirely; price-changed lines
 * are still added, at the *current* price.
 */
export async function reorderSubOrder(userId: string | undefined, subOrder: SubOrder): Promise<ReorderOutcome> {
  const priced = await priceCart({
    items: subOrder.items.map((item) => ({ listingId: item.listingId, qty: item.qty })),
  })

  const changedItems: ReorderChangedItem[] = []
  let addedCount = 0

  for (const original of subOrder.items) {
    const pricedItem = priced.sellerGroups
      .flatMap((group) => group.items)
      .find((line) => line.listingId === original.listingId)

    const isUnavailable =
      priced.unavailableListingIds.includes(original.listingId) || !pricedItem || pricedItem.qty === 0
    if (isUnavailable || !pricedItem) {
      changedItems.push({ title: original.title, reason: 'unavailable' })
      continue
    }

    if (pricedItem.unitPricePaise !== original.unitPricePaise) {
      changedItems.push({ title: original.title, reason: 'price_changed' })
    }

    await addItemToCart(userId, {
      listingId: original.listingId,
      partId: original.partId,
      sellerId: subOrder.sellerId,
      qty: original.qty,
      unitPricePaise: pricedItem.unitPricePaise,
      tierMinQtyApplied: pricedItem.tierMinQtyApplied,
    })
    addedCount += 1
  }

  return { addedCount, changedItems }
}

/** OrdersPage's per-order "Reorder" button — an order can span several sellers' subOrders, so this fetches and reorders all of them. */
export async function reorderOrder(userId: string | undefined, orderId: string): Promise<ReorderOutcome> {
  const q = query(collection(db, 'subOrders').withConverter(clientConverter(subOrderConverter)), where('orderId', '==', orderId))
  const snapshot = await getDocs(q)

  const outcomes = await Promise.all(snapshot.docs.map((doc) => reorderSubOrder(userId, doc.data())))
  return outcomes.reduce<ReorderOutcome>(
    (acc, outcome) => ({
      addedCount: acc.addedCount + outcome.addedCount,
      changedItems: [...acc.changedItems, ...outcome.changedItems],
    }),
    { addedCount: 0, changedItems: [] },
  )
}
