import type { ListingStatus } from '@snapspare/shared'
import { formatINR } from '@snapspare/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { EmptyState } from '@/components/states/EmptyState'
import { ErrorState } from '@/components/states/ErrorState'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/features/auth/api/AuthProvider'
import { updateListingStatus } from '@/features/seller-listings/api/saveListing'
import { type SellerListingsStatusFilter, useSellerListings } from '@/features/seller-listings/api/useSellerListings'
import { BulkActionsToolbar } from '@/features/seller-listings/components/BulkActionsToolbar'
import { LowStockBadge } from '@/features/seller-listings/components/LowStockBadge'

const TAB_ORDER: SellerListingsStatusFilter[] = ['all', 'draft', 'active', 'paused', 'out_of_stock', 'rejected', 'archived']

const STATUS_BADGE: Record<ListingStatus, string> = {
  draft: 'bg-steel/10 text-steel',
  active: 'bg-verify/10 text-verify',
  paused: 'bg-steel/10 text-steel',
  out_of_stock: 'bg-alert/10 text-alert',
  rejected: 'bg-alert/10 text-alert',
  archived: 'bg-steel/10 text-steel',
}

export default function SellerListingsPage() {
  const { t } = useTranslation()
  const { claims } = useAuth()
  const sellerId = claims?.sellerId
  const navigate = useNavigate()
  const [tab, setTab] = useState<SellerListingsStatusFilter>('all')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const { data: listings, isLoading, isError, refetch } = useSellerListings(sellerId, tab)

  function toggleSelected(id: string, checked: boolean) {
    setSelectedIds((prev) => (checked ? [...prev, id] : prev.filter((existing) => existing !== id)))
  }

  function toggleSelectAll(checked: boolean) {
    setSelectedIds(checked ? (listings ?? []).map((listing) => listing.id) : [])
  }

  async function handleBulkActionComplete() {
    setSelectedIds([])
    await refetch()
  }

  async function handleStatusChange(id: string, status: 'active' | 'paused' | 'archived') {
    setBusyId(id)
    try {
      await updateListingStatus({ id, status })
      await refetch()
    } catch (error) {
      const message = (error as { message?: string } | null)?.message ?? ''
      toast.error(
        message === 'cannot_activate_out_of_stock'
          ? t('sellerListings.addFlow.publishBlockedOutOfStock')
          : t('common.somethingWentWrong'),
      )
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-heading text-2xl font-semibold text-ink">{t('sellerListings.title')}</h1>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/seller/listings/bulk-upload">{t('sellerListings.bulkUpload.navLink')}</Link>
          </Button>
          <Button asChild variant="cta" size="sm">
            <Link to="/seller/listings/new">{t('sellerListings.addAction')}</Link>
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value as SellerListingsStatusFilter)}>
        <TabsList aria-label={t('sellerListings.title')}>
          {TAB_ORDER.map((key) => (
            <TabsTrigger key={key} value={key}>
              {t(`sellerListings.tabs.${key}`)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : !listings || listings.length === 0 ? (
        <EmptyState
          title={t('sellerListings.emptyTitle')}
          description={t('sellerListings.emptyDescription')}
          actionLabel={t('sellerListings.addAction')}
          onAction={() => navigate('/seller/listings/new')}
        />
      ) : (
        <div className="space-y-3">
          {sellerId ? (
            <BulkActionsToolbar
              selectedListingIds={selectedIds}
              onClearSelection={() => setSelectedIds([])}
              onActionComplete={handleBulkActionComplete}
            />
          ) : null}

          <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Checkbox
                  aria-label={t('sellerListings.bulkActions.selectAll')}
                  checked={listings.length > 0 && selectedIds.length === listings.length}
                  onChange={(e) => toggleSelectAll(e.target.checked)}
                />
              </TableHead>
              <TableHead>{t('sellerListings.table.part')}</TableHead>
              <TableHead>{t('sellerListings.table.sku')}</TableHead>
              <TableHead>{t('sellerListings.table.price')}</TableHead>
              <TableHead>{t('sellerListings.table.stock')}</TableHead>
              <TableHead>{t('sellerListings.table.status')}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {listings.map((listing) => {
              const firstTier = listing.pricing.tiers[0]
              return (
                <TableRow key={listing.id}>
                  <TableCell>
                    <Checkbox
                      aria-label={t('sellerListings.bulkActions.selectRow', { title: listing.title })}
                      checked={selectedIds.includes(listing.id)}
                      onChange={(e) => toggleSelected(listing.id, e.target.checked)}
                    />
                  </TableCell>
                  <TableCell>
                    <Link to={`/seller/listings/${listing.id}/edit`} className="font-medium text-ink hover:underline">
                      {listing.title}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{listing.sku}</TableCell>
                  <TableCell className="font-mono">{firstTier ? formatINR(firstTier.unitPricePaise) : '—'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono">{listing.stockQty - listing.reservedStock}</span>
                      <LowStockBadge
                        stockQty={listing.stockQty}
                        reservedStock={listing.reservedStock}
                        lowStockThresholdQty={listing.lowStockThresholdQty}
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[listing.status]}`}>
                      {t(`sellerListings.status.${listing.status}`)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1.5">
                      <Button asChild variant="outline" size="sm">
                        <Link to={`/seller/listings/${listing.id}/edit`}>{t('sellerListings.actions.edit')}</Link>
                      </Button>
                      <Button asChild variant="outline" size="sm">
                        <Link to={`/seller/listings/${listing.id}/inventory`}>{t('sellerListings.actions.stock')}</Link>
                      </Button>
                      {listing.status === 'draft' || listing.status === 'paused' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busyId === listing.id}
                          onClick={() => handleStatusChange(listing.id, 'active')}
                        >
                          {t('sellerListings.actions.activate')}
                        </Button>
                      ) : null}
                      {listing.status === 'active' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busyId === listing.id}
                          onClick={() => handleStatusChange(listing.id, 'paused')}
                        >
                          {t('sellerListings.actions.pause')}
                        </Button>
                      ) : null}
                      {listing.status !== 'archived' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busyId === listing.id}
                          onClick={() => handleStatusChange(listing.id, 'archived')}
                        >
                          {t('sellerListings.actions.archive')}
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
