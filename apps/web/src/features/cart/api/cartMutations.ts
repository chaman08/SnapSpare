import type { Cart, CartItem, CartSellerGroup } from '@snapspare/shared'
import { cartConverter } from '@snapspare/shared'
import { doc, runTransaction } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'
import { useGuestCartStore } from '@/stores/guestCartStore'

function cartRef(userId: string) {
  return doc(db, 'carts', userId).withConverter(clientConverter(cartConverter))
}

/** Reads the cart doc inside a transaction, defaulting every optional field so callers never have to null-check. */
async function readCart(tx: Parameters<Parameters<typeof runTransaction>[1]>[0], userId: string) {
  const snapshot = await tx.get(cartRef(userId))
  const existing: Cart | undefined = snapshot.exists() ? snapshot.data() : undefined
  return {
    sellerGroups: existing?.sellerGroups ?? [],
    savedItems: existing?.savedItems ?? [],
    couponCode: existing?.couponCode,
    createdAt: existing?.createdAt,
  }
}

function writeCart(
  tx: Parameters<Parameters<typeof runTransaction>[1]>[0],
  userId: string,
  data: { sellerGroups: CartSellerGroup[]; savedItems: CartItem[]; couponCode?: string; createdAt?: number },
) {
  const now = Date.now()
  tx.set(cartRef(userId), {
    id: userId,
    userId,
    sellerGroups: data.sellerGroups.filter((group) => group.items.length > 0),
    savedItems: data.savedItems,
    couponCode: data.couponCode,
    createdAt: data.createdAt ?? now,
    updatedAt: now,
  })
}

/** Sets a line's quantity directly (used by the cart page's stepper) — 0 or below removes the line entirely. */
export async function updateCartItemQty(
  userId: string | undefined,
  listingId: string,
  qty: number,
): Promise<void> {
  if (!userId) {
    if (qty <= 0) useGuestCartStore.getState().removeItem(listingId)
    else useGuestCartStore.getState().setQty(listingId, qty)
    return
  }

  await runTransaction(db, async (tx) => {
    const cart = await readCart(tx, userId)
    const sellerGroups = cart.sellerGroups
      .map((group) => ({
        ...group,
        items: group.items
          .map((item) => (item.listingId === listingId ? { ...item, qty } : item))
          .filter((item) => item.qty > 0),
      }))
      .filter((group) => group.items.length > 0)

    writeCart(tx, userId, { ...cart, sellerGroups })
  })
}

/** Removes a line entirely. Returns the removed item so the caller can offer an "undo" toast. */
export async function removeCartItem(userId: string | undefined, listingId: string): Promise<void> {
  if (!userId) {
    useGuestCartStore.getState().removeItem(listingId)
    return
  }

  await runTransaction(db, async (tx) => {
    const cart = await readCart(tx, userId)
    const sellerGroups = cart.sellerGroups
      .map((group) => ({ ...group, items: group.items.filter((item) => item.listingId !== listingId) }))
      .filter((group) => group.items.length > 0)

    writeCart(tx, userId, { ...cart, sellerGroups })
  })
}

/** Undoes a removal by re-adding the exact item snapshot — used by the remove-with-undo toast. */
export async function restoreCartItem(userId: string | undefined, item: CartItem): Promise<void> {
  if (!userId) {
    useGuestCartStore.getState().addItem(item)
    return
  }

  await runTransaction(db, async (tx) => {
    const cart = await readCart(tx, userId)
    const groupIndex = cart.sellerGroups.findIndex((group) => group.sellerId === item.sellerId)
    const group = groupIndex >= 0 ? cart.sellerGroups[groupIndex] : undefined
    const items = group ? [...group.items, item] : [item]
    const sellerGroups =
      groupIndex >= 0
        ? cart.sellerGroups.map((g, i) => (i === groupIndex ? { sellerId: item.sellerId, items } : g))
        : [...cart.sellerGroups, { sellerId: item.sellerId, items }]

    writeCart(tx, userId, { ...cart, sellerGroups })
  })
}

/** Moves a line to the "save for later" shelf (design spec item 8) — out of the priced cart until moved back. */
export async function saveCartItemForLater(userId: string | undefined, listingId: string): Promise<void> {
  if (!userId) {
    useGuestCartStore.getState().saveForLater(listingId)
    return
  }

  await runTransaction(db, async (tx) => {
    const cart = await readCart(tx, userId)
    let moved: CartItem | undefined
    const sellerGroups = cart.sellerGroups
      .map((group) => {
        const item = group.items.find((line) => line.listingId === listingId)
        if (item) moved = item
        return { ...group, items: group.items.filter((line) => line.listingId !== listingId) }
      })
      .filter((group) => group.items.length > 0)

    if (!moved) return
    const savedItems = [...cart.savedItems.filter((line) => line.listingId !== listingId), moved]
    writeCart(tx, userId, { ...cart, sellerGroups, savedItems })
  })
}

/** Moves a line from "save for later" back into the active cart, merging quantity if it's already there. */
export async function moveCartItemToCart(userId: string | undefined, listingId: string): Promise<void> {
  if (!userId) {
    useGuestCartStore.getState().moveToCart(listingId)
    return
  }

  await runTransaction(db, async (tx) => {
    const cart = await readCart(tx, userId)
    const item = cart.savedItems.find((line) => line.listingId === listingId)
    if (!item) return
    const savedItems = cart.savedItems.filter((line) => line.listingId !== listingId)

    const groupIndex = cart.sellerGroups.findIndex((group) => group.sellerId === item.sellerId)
    const group = groupIndex >= 0 ? cart.sellerGroups[groupIndex] : undefined
    const existingIndex = group?.items.findIndex((line) => line.listingId === listingId) ?? -1
    const items =
      group && existingIndex >= 0
        ? group.items.map((line, i) => (i === existingIndex ? { ...line, qty: line.qty + item.qty } : line))
        : [...(group?.items ?? []), item]
    const sellerGroups =
      groupIndex >= 0
        ? cart.sellerGroups.map((g, i) => (i === groupIndex ? { sellerId: item.sellerId, items } : g))
        : [...cart.sellerGroups, { sellerId: item.sellerId, items }]

    writeCart(tx, userId, { ...cart, sellerGroups, savedItems })
  })
}

export async function removeSavedCartItem(userId: string | undefined, listingId: string): Promise<void> {
  if (!userId) {
    useGuestCartStore.getState().removeSavedItem(listingId)
    return
  }

  await runTransaction(db, async (tx) => {
    const cart = await readCart(tx, userId)
    const savedItems = cart.savedItems.filter((item) => item.listingId !== listingId)
    writeCart(tx, userId, { ...cart, savedItems })
  })
}

/** Clears every active line (design spec item 8) — leaves "save for later" items untouched. */
export async function clearCart(userId: string | undefined): Promise<void> {
  if (!userId) {
    useGuestCartStore.getState().clear()
    return
  }

  await runTransaction(db, async (tx) => {
    const cart = await readCart(tx, userId)
    writeCart(tx, userId, { ...cart, sellerGroups: [] })
  })
}

export async function setCartCoupon(userId: string | undefined, couponCode: string | undefined): Promise<void> {
  if (!userId) return // guest carts don't persist a coupon — CartPage keeps it in local component state instead
  await runTransaction(db, async (tx) => {
    const cart = await readCart(tx, userId)
    writeCart(tx, userId, { ...cart, couponCode })
  })
}
