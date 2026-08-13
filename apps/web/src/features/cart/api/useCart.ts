import type { Cart, CartItem, CartSellerGroup } from '@snapspare/shared'
import { cartConverter } from '@snapspare/shared'
import { doc, onSnapshot } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'
import { useGuestCartStore } from '@/stores/guestCartStore'

interface UseCartResult {
  sellerGroups: CartSellerGroup[]
  savedItems: CartItem[]
  couponCode: string | undefined
  loading: boolean
  error: Error | null
}

function groupGuestItems(items: CartItem[]): CartSellerGroup[] {
  const bySeller = new Map<string, CartItem[]>()
  for (const item of items) {
    const bucket = bySeller.get(item.sellerId) ?? []
    bucket.push(item)
    bySeller.set(item.sellerId, bucket)
  }
  return Array.from(bySeller.entries()).map(([sellerId, groupItems]) => ({ sellerId, items: groupItems }))
}

/**
 * Unified read of "the buyer's cart" regardless of sign-in state: a live
 * Firestore subscription for signed-in buyers (same onSnapshot pattern as
 * useGarageVehicles), the local guest cart store otherwise — mergeGuestCart
 * already handles moving one into the other on sign-in. Grouped by seller
 * (rather than flattened) since Phase 7's cart page renders one section per
 * seller with its own subtotal/shipping.
 */
export function useCart(userId: string | undefined): UseCartResult {
  const [cart, setCart] = useState<Cart | null>(null)
  const [loading, setLoading] = useState(Boolean(userId))
  const [error, setError] = useState<Error | null>(null)
  const guestItems = useGuestCartStore((state) => state.items)
  const guestSavedItems = useGuestCartStore((state) => state.savedItems)

  useEffect(() => {
    if (!userId) {
      setCart(null)
      setLoading(false)
      return
    }
    setLoading(true)
    return onSnapshot(
      doc(db, 'carts', userId).withConverter(clientConverter(cartConverter)),
      (snapshot) => {
        setCart(snapshot.exists() ? snapshot.data() : null)
        setLoading(false)
        setError(null)
      },
      (err) => {
        setError(err)
        setLoading(false)
      },
    )
  }, [userId])

  if (!userId) {
    return {
      sellerGroups: groupGuestItems(guestItems),
      savedItems: guestSavedItems,
      couponCode: undefined,
      loading: false,
      error: null,
    }
  }

  return {
    sellerGroups: cart?.sellerGroups ?? [],
    savedItems: cart?.savedItems ?? [],
    couponCode: cart?.couponCode,
    loading,
    error,
  }
}
