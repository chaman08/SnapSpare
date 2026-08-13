import { formatINR } from '@snapspare/shared'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/states/EmptyState'
import { useAuth } from '@/features/auth/api/AuthProvider'
import { addItemToCart } from '@/features/cart/api/addToCart'
import { usePopularPartsForVehicle } from '@/features/cart/api/usePopularPartsForVehicle'
import { ProductCard } from '@/features/catalog/components/ProductCard'
import { useRecentOrders } from '@/features/orders/api/useRecentOrders'
import { useActiveVehicleStore } from '@/stores/activeVehicleStore'

interface CartEmptyStateProps {
  onOpenBulkPad: () => void
}

/**
 * Empty cart state (design spec item 9): never a dead end — offers recent
 * orders to reorder, the active vehicle's popular parts, and the bulk order
 * pad, alongside the standard "browse categories" action. Each rail is
 * best-effort and simply renders nothing if there's no signal (new buyer, no
 * active vehicle) rather than showing a broken/empty section.
 */
export function CartEmptyState({ onOpenBulkPad }: CartEmptyStateProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const activeVehicle = useActiveVehicleStore((state) => state.activeVehicle)
  const recentOrdersQuery = useRecentOrders(user?.uid)
  const popularPartsQuery = usePopularPartsForVehicle(activeVehicle?.modelId)

  async function handleReorder(subOrderId: string) {
    const subOrder = recentOrdersQuery.data?.find((order) => order.id === subOrderId)
    if (!subOrder) return
    try {
      for (const item of subOrder.items) {
        await addItemToCart(user?.uid, {
          listingId: item.listingId,
          partId: item.partId,
          sellerId: subOrder.sellerId,
          qty: item.qty,
          unitPricePaise: item.unitPricePaise,
          tierMinQtyApplied: item.tierMinQtyApplied,
        })
      }
      toast.success(t('cart.emptyState.reorderAdded'))
    } catch {
      toast.error(t('common.somethingWentWrong'))
    }
  }

  return (
    <div className="space-y-8 px-4 py-6">
      <EmptyState
        title={t('cart.emptyTitle')}
        description={t('cart.emptyDescription')}
        actionLabel={t('common.noResultsAction')}
        onAction={() => navigate('/categories')}
      />

      {recentOrdersQuery.data && recentOrdersQuery.data.length > 0 ? (
        <section>
          <h2 className="mb-3 font-heading text-lg font-semibold text-ink">{t('cart.emptyState.recentOrders')}</h2>
          <ul className="space-y-2">
            {recentOrdersQuery.data.map((order) => (
              <li
                key={order.id}
                className="flex items-center justify-between gap-3 rounded-[6px] border border-steel/20 p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-ink">
                    {t('cart.emptyState.orderItemCount', { count: order.items.length })}
                  </p>
                  <p className="font-mono text-xs text-steel">{formatINR(order.totalPaise)}</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => handleReorder(order.id)}>
                  {t('cart.emptyState.reorder')}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {popularPartsQuery.data && popularPartsQuery.data.length > 0 ? (
        <section>
          <h2 className="mb-3 font-heading text-lg font-semibold text-ink">
            {t('cart.emptyState.popularForVehicle', { vehicle: activeVehicle?.modelName ?? '' })}
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {popularPartsQuery.data.map((listing) => (
              <ProductCard key={listing.listingId} listing={listing} className="w-44 shrink-0 sm:w-52" />
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-[6px] border border-dashed border-steel/30 p-4 text-center">
        <p className="mb-2 text-sm text-steel">{t('cart.emptyState.bulkPadPrompt')}</p>
        <Button type="button" variant="outline" onClick={onOpenBulkPad}>
          {t('cart.bulkPad.open')}
        </Button>
      </section>
    </div>
  )
}
