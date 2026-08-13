import type { Cart, CartItem, CartSellerGroup } from '@snapspare/shared'
import { cartConverter } from '@snapspare/shared'
import { doc, runTransaction } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'
import { useActiveVehicleStore } from '@/stores/activeVehicleStore'
import { useGuestCartStore } from '@/stores/guestCartStore'

export interface AddToCartItem {
  listingId: string
  partId: string
  sellerId: string
  qty: number
  unitPricePaise: number
  tierMinQtyApplied: number
}

/**
 * Adds (or increments) one line item — used by ProductCard's inline
 * add-to-cart everywhere a listing can be added from search/category
 * browse. Signed-out visitors write to the local guest cart (merged into
 * Firestore on sign-in, see mergeGuestCart.ts); signed-in buyers write
 * straight to their `carts/{uid}` doc inside a transaction so two rapid taps
 * (or two tabs) can't clobber each other's quantity update.
 *
 * unitPricePaise/tierMinQtyApplied are a display-only snapshot (see
 * cartItemSchema's doc comment) — checkout always recomputes the payable
 * total server-side.
 */
/** Builds the human-readable "Fitted to" label from the active vehicle store, e.g. "Maruti Suzuki Swift VDI 2018". */
function activeVehicleLabel(): { vehicleId: string; vehicleLabel: string } | undefined {
  const vehicle = useActiveVehicleStore.getState().activeVehicle
  if (!vehicle) return undefined
  const label = [vehicle.makeName, vehicle.modelName, vehicle.variantName, vehicle.year ? String(vehicle.year) : undefined]
    .filter(Boolean)
    .join(' ')
  return { vehicleId: vehicle.garageVehicleId, vehicleLabel: label }
}

export async function addItemToCart(userId: string | undefined, item: AddToCartItem): Promise<void> {
  if (!userId) {
    useGuestCartStore.getState().addItem(item)
    return
  }

  const cartRef = doc(db, 'carts', userId).withConverter(clientConverter(cartConverter))
  const vehicle = activeVehicleLabel()

  await runTransaction(db, async (tx) => {
    const snapshot = await tx.get(cartRef)
    const existing: Cart | undefined = snapshot.exists() ? snapshot.data() : undefined
    const now = Date.now()

    const sellerGroups: CartSellerGroup[] = existing?.sellerGroups ?? []
    const groupIndex = sellerGroups.findIndex((group) => group.sellerId === item.sellerId)
    const group = groupIndex >= 0 ? sellerGroups[groupIndex] : undefined
    const items: CartItem[] = group ? [...group.items] : []
    const itemIndex = items.findIndex((line) => line.listingId === item.listingId)

    if (itemIndex >= 0) {
      const current = items[itemIndex] as CartItem
      items[itemIndex] = { ...current, qty: current.qty + item.qty, addedAt: current.addedAt }
    } else {
      items.push({
        ...item,
        vehicleId: vehicle?.vehicleId,
        vehicleLabel: vehicle?.vehicleLabel,
        addedAt: now,
      })
    }

    const nextGroups =
      groupIndex >= 0
        ? sellerGroups.map((g, i) => (i === groupIndex ? { sellerId: item.sellerId, items } : g))
        : [...sellerGroups, { sellerId: item.sellerId, items }]

    tx.set(cartRef, {
      id: userId,
      userId,
      sellerGroups: nextGroups,
      savedItems: existing?.savedItems ?? [],
      couponCode: existing?.couponCode,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    })
  })
}
