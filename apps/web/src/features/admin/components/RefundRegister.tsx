import { formatINR } from '@snapspare/shared'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/components/states/EmptyState'
import { ErrorState } from '@/components/states/ErrorState'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useRefundRegister } from '@/features/admin/api/financeActions'

/** Finance module's refund register (design brief item 8): every refund-type ledger entry platform-wide, most recent first. */
export function RefundRegister() {
  const { t } = useTranslation()
  const { data, isLoading, isError, refetch } = useRefundRegister()

  if (isLoading) return <Skeleton className="h-48 w-full" />
  if (isError) return <ErrorState onRetry={() => refetch()} />
  if (!data || data.length === 0) return <EmptyState title={t('admin.finance.refundRegister.emptyTitle')} />

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('admin.finance.ledger.type')}</TableHead>
          <TableHead>{t('admin.finance.ledger.amount')}</TableHead>
          <TableHead>{t('admin.finance.ledger.date')}</TableHead>
          <TableHead>{t('admin.finance.ledger.description')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((entry) => (
          <TableRow key={entry.id}>
            <TableCell className="text-xs">{t(`admin.finance.refundRegister.types.${entry.type}`, { defaultValue: entry.type })}</TableCell>
            <TableCell className="font-mono">{formatINR(entry.amountPaise)}</TableCell>
            <TableCell className="text-xs text-steel">{new Date(entry.createdAt).toLocaleString('en-IN')}</TableCell>
            <TableCell className="text-xs text-steel">{entry.description ?? '—'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
