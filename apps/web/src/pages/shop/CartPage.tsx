import type { CartItem } from '@snapspare/shared'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/states/ErrorState'
import { useAddresses } from '@/features/auth/api/addresses'
import { useAuth } from '@/features/auth/api/AuthProvider'
import { addItemToCart } from '@/features/cart/api/addToCart'
import { BulkOrderPad } from '@/features/cart/components/BulkOrderPad'
import { CartEmptyState } from '@/features/cart/components/CartEmptyState'
import { CartFitmentGuard } from '@/features/cart/components/CartFitmentGuard'
import { CartSellerGroupSection } from '@/features/cart/components/CartSellerGroupSection'
import { CouponInput } from '@/features/cart/components/CouponInput'
import { OrderSummary } from '@/features/cart/components/OrderSummary'
import { SavedForLaterList } from '@/features/cart/components/SavedForLaterList'
import {
  clearCart,
  moveCartItemToCart,
  removeCartItem,
  removeSavedCartItem,
  restoreCartItem,
  saveCartItemForLater,
  setCartCoupon,
  updateCartItemQty,
} from '@/features/cart/api/cartMutations'
import { mapPriceCartErrorToI18nKey, usePriceCart } from '@/features/cart/api/priceCart'
import { useCart } from '@/features/cart/api/useCart'
import { useDebouncedValue } from '@/features/search/lib/useDebouncedValue'

const PRICE_DEBOUNCE_MS = 350

/**
 * Cart page (Phase 7): renders exactly what priceCart returns — subtotal,
 * discount, per-seller shipping, tax split, grand total — and never
 * recomputes a payable amount itself. Line-item add/qty/remove/save-for-later
 * stay direct optimistic Firestore writes (see cartMutations.ts); only the
 * money comes from the server.
 */
export default function CartPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const { sellerGroups, savedItems, couponCode, loading, error } = useCart(user?.uid)
  const { addresses } = useAddresses(user?.uid)

  const [pendingListingIds, setPendingListingIds] = useState<Set<string>>(new Set())
  const [couponPending, setCouponPending] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [bulkPadOpen, setBulkPadOpen] = useState(false)

  const flatItems = useMemo<CartItem[]>(() => sellerGroups.flatMap((group) => group.items), [sellerGroups])
  const defaultPincode = addresses.find((address) => address.isDefault)?.pincode ?? addresses[0]?.pincode

  const priceCartArgs = useMemo(() => {
    if (flatItems.length === 0) return null
    return {
      items: flatItems.map((item) => ({
        listingId: item.listingId,
        qty: item.qty,
        snapshotUnitPricePaise: item.unitPricePaise,
        snapshotTierMinQtyApplied: item.tierMinQtyApplied,
      })),
      couponCode,
      pincode: defaultPincode,
      buyerType: profile?.buyerType,
    }
  }, [flatItems, couponCode, defaultPincode, profile?.buyerType])

  const debouncedArgs = useDebouncedValue(priceCartArgs, PRICE_DEBOUNCE_MS)
  const priceQuery = usePriceCart(debouncedArgs)

  function withPending(listingId: string, task: () => Promise<void>) {
    setPendingListingIds((prev) => new Set(prev).add(listingId))
    return task()
      .catch(() => toast.error(t('common.somethingWentWrong')))
      .finally(() => {
        setPendingListingIds((prev) => {
          const next = new Set(prev)
          next.delete(listingId)
          return next
        })
      })
  }

  function handleQtyChange(listingId: string, qty: number) {
    void withPending(listingId, () => updateCartItemQty(user?.uid, listingId, qty))
  }

  function handleRemove(listingId: string) {
    const item = flatItems.find((line) => line.listingId === listingId)
    void withPending(listingId, () => removeCartItem(user?.uid, listingId)).then(() => {
      if (!item) return
      toast(t('cart.removed'), {
        action: {
          label: t('cart.undo'),
          onClick: () => void restoreCartItem(user?.uid, item),
        },
      })
    })
  }

  function handleSaveForLater(listingId: string) {
    void withPending(listingId, () => saveCartItemForLater(user?.uid, listingId))
  }

  function handleMoveToCart(listingId: string) {
    void withPending(listingId, () => moveCartItemToCart(user?.uid, listingId))
  }

  function handleRemoveSaved(listingId: string) {
    void withPending(listingId, () => removeSavedCartItem(user?.uid, listingId))
  }

  function handleSwitchSeller(currentListingId: string, newListingId: string, newSellerId: string, qty: number) {
    const currentLine = priceQuery.data?.sellerGroups
      .flatMap((group) => group.items)
      .find((line) => line.listingId === currentListingId)
    if (!currentLine?.cheaperElsewhere) return
    const { cheaperElsewhere } = currentLine

    void withPending(currentListingId, async () => {
      await addItemToCart(user?.uid, {
        listingId: newListingId,
        partId: currentLine.partId,
        sellerId: newSellerId,
        qty,
        unitPricePaise: cheaperElsewhere.unitPricePaise,
        tierMinQtyApplied: qty,
      })
      await removeCartItem(user?.uid, currentListingId)
    })
  }

  async function handleApplyCoupon(code: string) {
    setCouponPending(true)
    try {
      await setCartCoupon(user?.uid, code)
    } finally {
      setCouponPending(false)
    }
  }

  async function handleRemoveCoupon() {
    setCouponPending(true)
    try {
      await setCartCoupon(user?.uid, undefined)
    } finally {
      setCouponPending(false)
    }
  }

  async function handleClearCart() {
    if (!window.confirm(t('cart.confirmClear'))) return
    setClearing(true)
    try {
      await clearCart(user?.uid)
    } catch {
      toast.error(t('common.somethingWentWrong'))
    } finally {
      setClearing(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-3 px-4 py-6">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6">
        <ErrorState onRetry={() => window.location.reload()} />
      </div>
    )
  }

  if (sellerGroups.length === 0 && savedItems.length === 0) {
    return (
      <div className="mx-auto max-w-6xl">
        <CartEmptyState onOpenBulkPad={() => setBulkPadOpen(true)} />
        {bulkPadOpen ? (
          <div className="px-4 pb-6">
            <BulkOrderPad open={bulkPadOpen} onOpenChange={setBulkPadOpen} />
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-semibold text-ink">{t('cart.title')}</h1>
        {sellerGroups.length > 0 ? (
          <Button type="button" variant="ghost" size="sm" disabled={clearing} onClick={handleClearCart}>
            {t('cart.clearCart')}
          </Button>
        ) : null}
      </div>

      <CartFitmentGuard items={flatItems} />

      {priceQuery.isError ? (
        <p role="alert" className="text-sm text-alert">
          {t(mapPriceCartErrorToI18nKey(priceQuery.error))}
        </p>
      ) : null}

      {sellerGroups.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            {priceQuery.data
              ? priceQuery.data.sellerGroups.map((group) => (
                  <CartSellerGroupSection
                    key={group.sellerId}
                    group={group}
                    freeShippingThresholdPaise={priceQuery.data.freeShippingThresholdPaise}
                    pendingListingIds={pendingListingIds}
                    onQtyChange={handleQtyChange}
                    onRemove={handleRemove}
                    onSaveForLater={handleSaveForLater}
                    onSwitchSeller={handleSwitchSeller}
                  />
                ))
              : sellerGroups.map((group) => (
                  <div key={group.sellerId} className="space-y-2 rounded-[6px] border border-steel/20 p-4">
                    <Skeleton className="h-5 w-1/3" />
                    {group.items.map((item) => (
                      <Skeleton key={item.listingId} className="h-16 w-full" />
                    ))}
                  </div>
                ))}

            {priceQuery.data?.unavailableListingIds.length ? (
              <p className="text-sm text-alert">
                {t('cart.unavailableItemsNotice', { count: priceQuery.data.unavailableListingIds.length })}
              </p>
            ) : null}
          </div>

          <div className="space-y-4">
            <CouponInput coupon={priceQuery.data?.coupon} onApply={handleApplyCoupon} onRemove={handleRemoveCoupon} pending={couponPending} />
            {priceQuery.data ? (
              <OrderSummary
                result={priceQuery.data}
                onCheckout={() => navigate('/checkout')}
                checkoutDisabled={priceQuery.isFetching || pendingListingIds.size > 0}
              />
            ) : (
              <Skeleton className="h-64 w-full" />
            )}
          </div>
        </div>
      ) : null}

      <SavedForLaterList
        items={savedItems}
        pendingListingIds={pendingListingIds}
        onMoveToCart={handleMoveToCart}
        onRemove={handleRemoveSaved}
      />

      <BulkOrderPad open={bulkPadOpen} onOpenChange={setBulkPadOpen} />
    </div>
  )
}
