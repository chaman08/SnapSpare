import { maskGstin, type Seller } from '@snapspare/shared'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { EmptyState } from '@/components/states/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAdminSellers } from '@/features/admin/api/sellerAdminActions'
import { SellerManageDialog } from '@/features/admin/components/SellerManageDialog'
import { cn } from '@/lib/utils'

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-verify/10 text-verify',
  suspended: 'bg-alert/10 text-alert',
  pending_verification: 'bg-signal/10 text-signal',
  rejected: 'bg-steel/10 text-steel',
  deactivated: 'bg-steel/10 text-steel',
}

/** Sellers module (design brief item 2) performance table: search + status/rating/commission at a glance, with suspend/reinstate/commission actions via SellerManageDialog. */
export function SellersTable() {
  const { t } = useTranslation()
  const { sellers, loading } = useAdminSellers()
  const [searchTerm, setSearchTerm] = useState('')
  const [managing, setManaging] = useState<Seller | null>(null)

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return sellers
    return sellers.filter((seller) => seller.businessName.toLowerCase().includes(term) || seller.gstin.toLowerCase().includes(term))
  }, [sellers, searchTerm])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Input
          className="max-w-xs"
          placeholder={t('admin.sellers.searchPlaceholder')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <Button variant="outline" size="sm" asChild>
          <Link to="/admin/seller-applications">{t('admin.nav.sellerApplications')}</Link>
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState title={t('admin.sellers.emptyTitle')} description={t('admin.sellers.emptyDescription')} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('admin.sellers.table.name')}</TableHead>
              <TableHead>{t('admin.sellers.table.status')}</TableHead>
              <TableHead>{t('admin.sellers.table.rating')}</TableHead>
              <TableHead>{t('admin.sellers.table.commission')}</TableHead>
              <TableHead>{t('admin.sellers.table.warnings')}</TableHead>
              <TableHead>{t('admin.sellers.table.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((seller) => (
              <TableRow key={seller.id}>
                <TableCell>
                  <p className="font-medium text-ink">{seller.businessName}</p>
                  <p className="font-mono text-xs text-steel">{maskGstin(seller.gstin)}</p>
                </TableCell>
                <TableCell>
                  <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_STYLES[seller.status])}>
                    {t(`admin.sellers.status.${seller.status}`, { defaultValue: seller.status })}
                  </span>
                </TableCell>
                <TableCell className="font-mono">
                  {seller.ratingAvg.toFixed(1)} ({seller.ratingCount})
                </TableCell>
                <TableCell className="font-mono">
                  {seller.commissionRatePercent !== undefined ? `${seller.commissionRatePercent}%` : t('admin.sellers.commissionPlatformDefault')}
                </TableCell>
                <TableCell className="font-mono">{seller.warningsCount}</TableCell>
                <TableCell>
                  <Button variant="outline" size="sm" onClick={() => setManaging(seller)}>
                    {t('admin.sellers.manage')}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <SellerManageDialog seller={managing} onOpenChange={(open) => !open && setManaging(null)} />
    </div>
  )
}
