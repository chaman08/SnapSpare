import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface GuestCartItem {
  listingId: string
  partId: string
  sellerId: string
  qty: number
  unitPricePaise: number
  tierMinQtyApplied: number
  addedAt: number
}

interface GuestCartState {
  items: GuestCartItem[]
  savedItems: GuestCartItem[]
  addItem: (item: Omit<GuestCartItem, 'addedAt'>) => void
  setQty: (listingId: string, qty: number) => void
  removeItem: (listingId: string) => void
  /** Moves a line from the active cart to the "save for later" shelf. */
  saveForLater: (listingId: string) => void
  /** Moves a line from the "save for later" shelf back into the active cart. */
  moveToCart: (listingId: string) => void
  removeSavedItem: (listingId: string) => void
  clear: () => void
}

/**
 * Cart for signed-out visitors, persisted to localStorage so it survives a
 * refresh. On sign-in, AuthProvider merges this into the buyer's Firestore
 * cart (see features/cart/api/mergeGuestCart.ts) and clears it.
 */
export const useGuestCartStore = create<GuestCartState>()(
  persist(
    (set) => ({
      items: [],
      savedItems: [],
      addItem: (item) =>
        set((state) => {
          const existing = state.items.find((i) => i.listingId === item.listingId)
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.listingId === item.listingId ? { ...i, qty: i.qty + item.qty } : i,
              ),
            }
          }
          return { items: [...state.items, { ...item, addedAt: Date.now() }] }
        }),
      setQty: (listingId, qty) =>
        set((state) => ({
          items: state.items.map((i) => (i.listingId === listingId ? { ...i, qty } : i)),
        })),
      removeItem: (listingId) =>
        set((state) => ({ items: state.items.filter((i) => i.listingId !== listingId) })),
      saveForLater: (listingId) =>
        set((state) => {
          const item = state.items.find((i) => i.listingId === listingId)
          if (!item) return state
          return {
            items: state.items.filter((i) => i.listingId !== listingId),
            savedItems: [...state.savedItems.filter((i) => i.listingId !== listingId), item],
          }
        }),
      moveToCart: (listingId) =>
        set((state) => {
          const item = state.savedItems.find((i) => i.listingId === listingId)
          if (!item) return state
          const existing = state.items.find((i) => i.listingId === listingId)
          return {
            savedItems: state.savedItems.filter((i) => i.listingId !== listingId),
            items: existing
              ? state.items.map((i) => (i.listingId === listingId ? { ...i, qty: i.qty + item.qty } : i))
              : [...state.items, item],
          }
        }),
      removeSavedItem: (listingId) =>
        set((state) => ({ savedItems: state.savedItems.filter((i) => i.listingId !== listingId) })),
      clear: () => set({ items: [] }),
    }),
    { name: 'snapspare-guest-cart' },
  ),
)
