import { formatINR } from '@snapspare/shared'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { EmptyState } from '@/components/states/EmptyState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { adminSetListingStatus, useAdminListings } from '@/features/admin/api/listingAdminActions'
import { cn } from '@/lib/utils'

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-verify/10 text-verify',
  paused: 'bg-steel/10 text-steel',
  out_of_stock: 'bg-signal/10 text-signal',
  rejected: 'bg-alert/10 text-alert',
  draft: 'bg-steel/10 text-steel',
  archived: 'bg-steel/10 text-steel',
}

/** Listings module (design brief item 5): recent-listings view scoped to an optional seller, title filter over the loaded page, and block/unblock. See useAdminListings' comment for the full-text-search limitation. */
export function ListingsSearchPanel() {
  const { t } = useTranslation()
  const [sellerIdFilter, setSellerIdFilter] = useState('')
  const [titleFilter, setTitleFilter] = useState('')
  const { listings, loading } = useAdminListings(sellerIdFilter)
  const [busyId, setBusyId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const term = titleFilter.trim().toLowerCase()
    if (!term) return listings
    return listings.filter((listing) => listing.title.toLowerCase().includes(term))
  }, [listings, titleFilter])

  async function toggleStatus(listingId: string, currentStatus: string) {
    if (currentStatus === 'rejected') {
      setBusyId(listingId)
      try {
        await adminSetListingStatus({ id: listingId, status: 'active' })
        toast.success(t('admin.listings.unblockSuccess'))
      } catch {
        toast.error(t('admin.listings.actionFailed'))
      } finally {
        setBusyId(null)
      }
      return
    }
    const reason = window.prompt(t('admin.listings.blockReasonPrompt'))
    if (!reason || reason.trim().length === 0) return
    setBusyId(listingId)
    try {
      await adminSetListingStatus({ id: listingId, status: 'rejected', reason: reason.trim() })
      toast.success(t('admin.listings.blockSuccess'))
    } catch {
      toast.error(t('admin.listings.actionFailed'))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Input className="max-w-xs" placeholder={t('admin.listings.sellerIdFilter')} value={sellerIdFilter} onChange={(e) => setSellerIdFilter(e.target.value)} />
        <Input className="max-w-xs" placeholder={t('admin.listings.titleFilter')} value={titleFilter} onChange={(e) => setTitleFilter(e.target.value)} />
      </div>

      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : filtered.length === 0 ? (
        <EmptyState title={t('admin.listings.emptyTitle')} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('admin.listings.title')}</TableHead>
              <TableHead>{t('admin.listings.seller')}</TableHead>
              <TableHead>{t('admin.listings.status')}</TableHead>
              <TableHead>{t('admin.listings.price')}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((listing) => (
              <TableRow key={listing.id}>
                <TableCell>{listing.title}</TableCell>
                <TableCell className="font-mono text-xs">{listing.sellerId}</TableCell>
                <TableCell>
                  <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_STYLES[listing.status])}>
                    {t(`admin.listings.statusValue.${listing.status}`, { defaultValue: listing.status })}
                  </span>
                </TableCell>
                <TableCell className="font-mono">{formatINR(listing.pricing.tiers[0]?.unitPricePaise ?? 0)}</TableCell>
                <TableCell>
                  <Button variant="outline" size="sm" disabled={busyId === listing.id} onClick={() => toggleStatus(listing.id, listing.status)}>
                    {listing.status === 'rejected' ? t('admin.listings.unblock') : t('admin.listings.block')}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
