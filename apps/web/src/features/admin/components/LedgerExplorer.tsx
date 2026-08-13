import { formatINR } from '@snapspare/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/components/states/EmptyState'
import { ErrorState } from '@/components/states/ErrorState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useLedgerEntries } from '@/features/admin/api/financeActions'

/** Finance module's ledger explorer (design brief item 8): one seller's full running-balance entry history, searched by sellerId. */
export function LedgerExplorer() {
  const { t } = useTranslation()
  const [sellerIdInput, setSellerIdInput] = useState('')
  const [sellerId, setSellerId] = useState('')
  const { data, isLoading, isError, refetch } = useLedgerEntries(sellerId)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[220px] flex-1">
          <Label htmlFor="ledger-seller-id">{t('admin.finance.ledger.sellerIdLabel')}</Label>
          <Input id="ledger-seller-id" value={sellerIdInput} onChange={(e) => setSellerIdInput(e.target.value)} />
        </div>
        <Button onClick={() => setSellerId(sellerIdInput.trim())} disabled={sellerIdInput.trim().length === 0}>
          {t('admin.orders.searchAction')}
        </Button>
      </div>

      {!sellerId ? null : isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : !data || data.length === 0 ? (
        <EmptyState title={t('admin.finance.ledger.emptyTitle')} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('admin.finance.ledger.type')}</TableHead>
              <TableHead>{t('admin.finance.ledger.amount')}</TableHead>
              <TableHead>{t('admin.finance.ledger.balanceAfter')}</TableHead>
              <TableHead>{t('admin.finance.ledger.date')}</TableHead>
              <TableHead>{t('admin.finance.ledger.description')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="text-xs">{entry.type}</TableCell>
                <TableCell className="font-mono">
                  {entry.direction === 'debit' ? '-' : '+'}
                  {formatINR(entry.amountPaise)}
                </TableCell>
                <TableCell className="font-mono">{formatINR(entry.balanceAfterPaise)}</TableCell>
                <TableCell className="text-xs text-steel">{new Date(entry.createdAt).toLocaleString('en-IN')}</TableCell>
                <TableCell className="text-xs text-steel">{entry.description ?? '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
