import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { EmptyState } from '@/components/states/EmptyState'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { saveBanner, useBanners } from '@/features/admin/api/marketingActions'

const SLOTS = ['home_hero', 'home_secondary', 'category_top'] as const

function toDateInputValue(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

/** Marketing module's banner/merchandising manager (design brief item 9) with slot scheduling. */
export function BannersPanel() {
  const { t } = useTranslation()
  const { banners, loading } = useBanners()
  const [open, setOpen] = useState(false)
  const [slot, setSlot] = useState<(typeof SLOTS)[number]>('home_hero')
  const [imageUrl, setImageUrl] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [sortOrder, setSortOrder] = useState('0')
  const [startAt, setStartAt] = useState(toDateInputValue(Date.now()))
  const [endAt, setEndAt] = useState(toDateInputValue(Date.now() + 30 * 24 * 60 * 60_000))
  const [busy, setBusy] = useState(false)

  async function create() {
    setBusy(true)
    try {
      await saveBanner({
        slot,
        imageUrl: imageUrl.trim(),
        linkUrl: linkUrl.trim() || undefined,
        sortOrder: Number(sortOrder) || 0,
        startAt: new Date(startAt).getTime(),
        endAt: new Date(endAt).getTime(),
        status: 'active',
      })
      toast.success(t('admin.marketing.banners.saveSuccess'))
      setOpen(false)
      setImageUrl('')
      setLinkUrl('')
    } catch {
      toast.error(t('admin.marketing.banners.saveFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setOpen(true)}>
          {t('admin.marketing.banners.newAction')}
        </Button>
      </div>

      {loading ? (
        <Skeleton className="h-48 w-full" />
      ) : banners.length === 0 ? (
        <EmptyState title={t('admin.marketing.banners.emptyTitle')} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('admin.marketing.banners.slot')}</TableHead>
              <TableHead>{t('admin.marketing.banners.schedule')}</TableHead>
              <TableHead>{t('admin.marketing.banners.sortOrder')}</TableHead>
              <TableHead>{t('admin.marketing.banners.status')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {banners.map((banner) => (
              <TableRow key={banner.id}>
                <TableCell className="text-xs">{banner.slot}</TableCell>
                <TableCell className="text-xs text-steel">
                  {new Date(banner.startAt).toLocaleDateString('en-IN')} – {new Date(banner.endAt).toLocaleDateString('en-IN')}
                </TableCell>
                <TableCell className="font-mono text-xs">{banner.sortOrder}</TableCell>
                <TableCell className="text-xs text-steel">{banner.status}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.marketing.banners.newAction')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="banner-slot">{t('admin.marketing.banners.slot')}</Label>
              <select
                id="banner-slot"
                className="flex min-h-tap w-full rounded-[6px] border border-steel/30 bg-surface px-3 text-sm text-ink"
                value={slot}
                onChange={(e) => setSlot(e.target.value as (typeof SLOTS)[number])}
                disabled={busy}
              >
                {SLOTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="banner-image">{t('admin.marketing.banners.imageUrl')}</Label>
              <Input id="banner-image" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} disabled={busy} />
            </div>
            <div>
              <Label htmlFor="banner-link">{t('admin.marketing.banners.linkUrl')}</Label>
              <Input id="banner-link" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} disabled={busy} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label htmlFor="banner-sort">{t('admin.marketing.banners.sortOrder')}</Label>
                <Input id="banner-sort" type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} disabled={busy} />
              </div>
              <div>
                <Label htmlFor="banner-start">{t('admin.marketing.banners.startAt')}</Label>
                <Input id="banner-start" type="date" value={startAt} onChange={(e) => setStartAt(e.target.value)} disabled={busy} />
              </div>
              <div>
                <Label htmlFor="banner-end">{t('admin.marketing.banners.endAt')}</Label>
                <Input id="banner-end" type="date" value={endAt} onChange={(e) => setEndAt(e.target.value)} disabled={busy} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={busy}>
              {t('common.close')}
            </Button>
            <Button size="sm" onClick={create} disabled={busy || !imageUrl.trim()}>
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
