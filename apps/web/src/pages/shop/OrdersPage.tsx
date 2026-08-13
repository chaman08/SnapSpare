import type { OrderStatus } from '@snapspare/shared'
import { formatINR, orderStatusSchema } from '@snapspare/shared'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { EmptyState } from '@/components/states/EmptyState'
import { ErrorState } from '@/components/states/ErrorState'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/features/auth/api/AuthProvider'
import { reorderOrder } from '@/features/orders/api/reorder'
import { useBuyerSubOrders } from '@/features/orders/api/useBuyerSubOrders'
import { useOrders } from '@/features/orders/api/useOrders'
import { cn } from '@/lib/utils'
import { useOfflineCacheStore } from '@/stores/offlineCacheStore'

const ORDER_STATUS_STYLES: Record<string, string> = {
  pending_payment: 'bg-alert/10 text-alert',
  placed: 'bg-steel/10 text-steel',
  confirmed: 'bg-verify/10 text-verify',
  processing: 'bg-verify/10 text-verify',
  partially_shipped: 'bg-signal/10 text-signal',
  shipped: 'bg-signal/10 text-signal',
  delivered: 'bg-verify/10 text-verify',
  completed: 'bg-verify/10 text-verify',
  cancelled: 'bg-alert/10 text-alert',
  refunded: 'bg-steel/10 text-steel',
}

const STATUS_FILTERS: Array<OrderStatus | 'all'> = ['all', ...orderStatusSchema.options]

/** Buyer's order history — loading skeleton, empty state with a next action, error state with retry, per the project's list-screen rule. */
export default function OrdersPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { orders, loading, error } = useOrders(user?.uid)
  const subOrders = useBuyerSubOrders(user?.uid)
  const setRecentOrdersCache = useOfflineCacheStore((s) => s.setRecentOrders)

  useEffect(() => {
    if (loading || error) return
    setRecentOrdersCache(
      orders.map((order) => ({
        id: order.id,
        status: order.status,
        totalPaise: order.totalPaise,
        placedAt: order.createdAt,
      })),
    )
  }, [orders, loading, error, setRecentOrdersCache])
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const [reorderingId, setReorderingId] = useState<string | null>(null)

  const itemTitlesByOrderId = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const subOrder of subOrders) {
      const titles = map.get(subOrder.orderId) ?? []
      for (const item of subOrder.items) titles.push(item.title)
      map.set(subOrder.orderId, titles)
    }
    return map
  }, [subOrders])

  const filteredOrders = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    return orders.filter((order) => {
      if (statusFilter !== 'all' && order.status !== statusFilter) return false
      if (!normalizedSearch) return true
      if (order.id.toLowerCase().includes(normalizedSearch)) return true
      return (itemTitlesByOrderId.get(order.id) ?? []).some((title) => title.toLowerCase().includes(normalizedSearch))
    })
  }, [orders, statusFilter, search, itemTitlesByOrderId])

  async function handleReorder(orderId: string) {
    setReorderingId(orderId)
    try {
      const outcome = await reorderOrder(user?.uid, orderId)
      if (outcome.addedCount > 0) {
        toast.success(t('orders.reorder.success', { count: outcome.addedCount }))
      }
      if (outcome.changedItems.length > 0) {
        toast.warning(t('orders.reorder.changedWarning', { count: outcome.changedItems.length }))
      }
      if (outcome.addedCount > 0) navigate('/cart')
    } catch {
      toast.error(t('orders.reorder.failure'))
    } finally {
      setReorderingId(null)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-3 px-4 py-6">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6">
        <ErrorState onRetry={() => window.location.reload()} />
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6">
        <EmptyState
          title={t('orders.emptyTitle')}
          description={t('orders.emptyDescription')}
          actionLabel={t('orders.startShopping')}
          onAction={() => navigate('/')}
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-heading text-2xl font-semibold text-ink">{t('orders.title')}</h1>
        <Link to="/rfq" className="text-sm font-medium text-signal hover:underline">
          {t('rfq.list.navLink')}
        </Link>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('orders.searchPlaceholder')}
          aria-label={t('orders.searchPlaceholder')}
          className="min-h-tap flex-1 rounded-[6px] border border-steel/30 bg-surface px-3 text-base text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
        />
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as OrderStatus | 'all')}
          aria-label={t('orders.filterByStatus')}
          className="min-h-tap rounded-[6px] border border-steel/30 bg-surface px-3 text-sm text-ink"
        >
          {STATUS_FILTERS.map((status) => (
            <option key={status} value={status}>
              {status === 'all' ? t('orders.allStatuses') : t(`orders.status.${status}`)}
            </option>
          ))}
        </select>
      </div>

      {filteredOrders.length === 0 ? (
        <EmptyState title={t('orders.noMatchingOrders')} />
      ) : (
        <ul className="space-y-3">
          {filteredOrders.map((order) => (
            <li key={order.id} className="rounded-[6px] border border-steel/20">
              <button
                type="button"
                onClick={() => navigate(`/orders/${order.id}`)}
                className="flex min-h-tap w-full flex-wrap items-center justify-between gap-2 p-4 text-left hover:bg-surface-muted"
              >
                <div>
                  <p className="font-mono text-sm text-ink">{order.id}</p>
                  <p className="text-sm text-steel">{new Date(order.placedAt).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-ink">{formatINR(order.totalPaise)}</span>
                  <span
                    className={cn(
                      'rounded-[6px] px-2.5 py-1 text-xs font-medium',
                      ORDER_STATUS_STYLES[order.status] ?? 'bg-steel/10 text-steel',
                    )}
                  >
                    {t(`orders.status.${order.status}`)}
                  </span>
                </div>
              </button>
              {order.status === 'delivered' || order.status === 'completed' ? (
                <div className="border-t border-steel/10 px-4 py-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={reorderingId === order.id}
                    onClick={(event) => {
                      event.stopPropagation()
                      void handleReorder(order.id)
                    }}
                  >
                    {reorderingId === order.id ? t('common.loading') : t('orders.reorder.action')}
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
