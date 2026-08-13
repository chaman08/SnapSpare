import type { SubOrder } from '@snapspare/shared'
import { formatINR } from '@snapspare/shared'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { EmptyState } from '@/components/states/EmptyState'
import { ErrorState } from '@/components/states/ErrorState'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

interface TodaysOrdersProps {
  subOrders: SubOrder[]
  isLoading: boolean
  isError: boolean
  onRetry: () => void
}

export function TodaysOrders({ subOrders, isLoading, isError, onRetry }: TodaysOrdersProps) {
  const { t } = useTranslation()

  return (
    <section className="rounded-[6px] border border-steel/20 bg-surface p-4" aria-labelledby="todays-orders-heading">
      <h2 id="todays-orders-heading" className="font-heading text-lg font-semibold text-ink">
        {t('sellerDashboard.todaysOrders.title')}
      </h2>

      <div className="mt-3">
        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : isError ? (
          <ErrorState onRetry={onRetry} />
        ) : subOrders.length === 0 ? (
          <EmptyState title={t('sellerDashboard.todaysOrders.emptyTitle')} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('sellerDashboard.todaysOrders.orderId')}</TableHead>
                <TableHead>{t('sellerDashboard.todaysOrders.items')}</TableHead>
                <TableHead>{t('sellerDashboard.todaysOrders.total')}</TableHead>
                <TableHead>{t('sellerDashboard.todaysOrders.status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subOrders.map((subOrder) => (
                <TableRow key={subOrder.id}>
                  <TableCell className="font-mono text-xs">{subOrder.id}</TableCell>
                  <TableCell>{subOrder.items.reduce((sum, item) => sum + item.qty, 0)}</TableCell>
                  <TableCell className="font-mono">{formatINR(subOrder.totalPaise)}</TableCell>
                  <TableCell>{t(`sellerOrders.tabs.${statusToTabKey(subOrder.status)}`)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Link to="/seller/orders" className="mt-3 inline-block text-sm font-medium text-signal underline underline-offset-2">
        {t('sellerDashboard.viewAllOrders')}
      </Link>
    </section>
  )
}

function statusToTabKey(status: SubOrder['status']): string {
  switch (status) {
    case 'pending':
      return 'new'
    case 'accepted':
      return 'toPack'
    case 'packed':
      return 'toShip'
    case 'shipped':
    case 'out_for_delivery':
      return 'shipped'
    case 'delivered':
      return 'delivered'
    case 'rejected':
    case 'cancelled':
      return 'cancelled'
    default:
      return 'delivered'
  }
}
