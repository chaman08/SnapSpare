import { formatINR } from '@snapspare/shared'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/components/states/EmptyState'
import { ErrorState } from '@/components/states/ErrorState'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { usePaymentReconciliationReport } from '@/features/admin/api/orderAdminActions'

/** Orders module payment reconciliation view (design brief item 6) — flags orders whose payment state looks off; see getPaymentReconciliationReport.ts for exactly what each issue means. */
export function PaymentReconciliationTable() {
  const { t } = useTranslation()
  const { data, isLoading, isError, refetch } = usePaymentReconciliationReport(7)

  if (isLoading) return <Skeleton className="h-48 w-full" />
  if (isError) return <ErrorState onRetry={() => refetch()} />
  if (!data || data.length === 0) return <EmptyState title={t('admin.orders.reconciliation.emptyTitle')} />

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('admin.orders.orderIdLabel')}</TableHead>
          <TableHead>{t('admin.orders.reconciliation.issue')}</TableHead>
          <TableHead>{t('admin.orders.paymentStatus')}</TableHead>
          <TableHead>{t('admin.orders.currentStatus')}</TableHead>
          <TableHead>{t('admin.orders.total')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((row) => (
          <TableRow key={row.orderId}>
            <TableCell className="font-mono text-xs">{row.orderId}</TableCell>
            <TableCell className="text-xs">{t(`admin.orders.reconciliation.issues.${row.issue}`)}</TableCell>
            <TableCell className="text-xs">{row.paymentStatus}</TableCell>
            <TableCell className="text-xs">{row.orderStatus}</TableCell>
            <TableCell className="font-mono">{formatINR(row.totalPaise)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
