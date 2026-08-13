import { formatINR } from '@snapspare/shared'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/components/states/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import { useLiveNewOrders } from '@/features/admin/api/dashboardActions'

/** Live feed of newly placed orders (design brief item 1) — a raw onSnapshot subscription, same live-queue pattern as the moderation queues, rather than a polled query. */
export function NewOrdersFeed() {
  const { t } = useTranslation()
  const { orders, loading } = useLiveNewOrders()

  return (
    <section className="rounded-[6px] border border-steel/20 bg-surface p-4" aria-labelledby="new-orders-heading">
      <h2 id="new-orders-heading" className="font-heading text-lg font-semibold text-ink">
        {t('admin.dashboard.newOrders.title')}
      </h2>
      <div className="mt-3">
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : orders.length === 0 ? (
          <EmptyState title={t('admin.dashboard.newOrders.emptyTitle')} />
        ) : (
          <ul className="divide-y divide-steel/10" aria-live="polite">
            {orders.map((order) => (
              <li key={order.id} className="flex items-center justify-between gap-3 py-2">
                <div>
                  <p className="font-mono text-xs text-steel">{order.id}</p>
                  <p className="text-xs text-steel">{new Date(order.placedAt).toLocaleString('en-IN')}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm font-medium text-ink">{formatINR(order.totalPaise)}</p>
                  <p className="text-xs text-steel">{t(`orders.status.${order.status}`, { defaultValue: order.status })}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
