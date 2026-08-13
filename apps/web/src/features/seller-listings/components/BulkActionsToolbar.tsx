import { CATEGORY_TREE } from '@snapspare/shared'
import { Loader2, Tag, Boxes, ToggleLeft } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { bulkPriceChange, bulkStatusChange, bulkStockUpdate } from '@/features/seller-listings/api/bulkActions'

interface BulkActionsToolbarProps {
  selectedListingIds: string[]
  onClearSelection: () => void
  onActionComplete: () => void
}

/** Requirement 4's bulk mutators. Price change is category/brand-scoped (bulkPriceChangeRequestSchema has no listingIds field — it targets everything matching the scope, not just the current page's checked rows), while stock and status changes operate on the checkbox selection. */
export function BulkActionsToolbar({ selectedListingIds, onClearSelection, onActionComplete }: BulkActionsToolbarProps) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-[6px] border border-steel/20 bg-surface-muted p-3">
      <PriceChangeDialog onComplete={onActionComplete} />

      {selectedListingIds.length > 0 ? (
        <>
          <span className="text-sm font-medium text-ink">
            {t('sellerListings.bulkActions.selectedCount', { count: selectedListingIds.length })}
          </span>
          <StockUpdateDialog listingIds={selectedListingIds} onComplete={onActionComplete} />
          <StatusChangeDialog listingIds={selectedListingIds} onComplete={onActionComplete} />
          <Button type="button" variant="ghost" size="sm" onClick={onClearSelection}>
            {t('sellerListings.bulkActions.clearSelection')}
          </Button>
        </>
      ) : null}
    </div>
  )
}

function PriceChangeDialog({ onComplete }: { onComplete: () => void }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [scopeType, setScopeType] = useState<'categorySlug' | 'brand'>('categorySlug')
  const [categorySlug, setCategorySlug] = useState(CATEGORY_TREE[0]?.slug ?? '')
  const [brand, setBrand] = useState('')
  const [mode, setMode] = useState<'percent' | 'absolute'>('percent')
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit() {
    const numericValue = Number(value)
    if (!Number.isFinite(numericValue) || numericValue === 0) {
      toast.error(t('sellerListings.bulkActions.priceChange.invalidValue'))
      return
    }
    setBusy(true)
    try {
      const result = await bulkPriceChange({
        scope: scopeType === 'categorySlug' ? { categorySlug } : { brand: brand.trim() },
        mode,
        value: mode === 'absolute' ? Math.round(numericValue * 100) : numericValue,
      })
      toast.success(
        t('sellerListings.bulkActions.priceChange.success', {
          updated: result.updatedListingIds.length,
          failed: result.failedListingIds.length,
        }),
      )
      setOpen(false)
      setValue('')
      onComplete()
    } catch {
      toast.error(t('common.somethingWentWrong'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Tag className="h-4 w-4" aria-hidden="true" />
          {t('sellerListings.bulkActions.priceChange.trigger')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('sellerListings.bulkActions.priceChange.title')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex gap-2">
            <Button
              type="button"
              variant={scopeType === 'categorySlug' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setScopeType('categorySlug')}
            >
              {t('sellerListings.bulkActions.priceChange.byCategory')}
            </Button>
            <Button
              type="button"
              variant={scopeType === 'brand' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setScopeType('brand')}
            >
              {t('sellerListings.bulkActions.priceChange.byBrand')}
            </Button>
          </div>

          {scopeType === 'categorySlug' ? (
            <div className="space-y-1.5">
              <Label htmlFor="bulk-price-category">{t('sellerListings.bulkActions.priceChange.categoryLabel')}</Label>
              <Select value={categorySlug} onValueChange={setCategorySlug}>
                <SelectTrigger id="bulk-price-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_TREE.map((category) => (
                    <SelectItem key={category.slug} value={category.slug}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="bulk-price-brand">{t('sellerListings.bulkActions.priceChange.brandLabel')}</Label>
              <Input id="bulk-price-brand" value={brand} onChange={(e) => setBrand(e.target.value)} />
            </div>
          )}

          <div className="flex gap-2">
            <Button type="button" variant={mode === 'percent' ? 'default' : 'outline'} size="sm" onClick={() => setMode('percent')}>
              {t('sellerListings.bulkActions.priceChange.percentMode')}
            </Button>
            <Button
              type="button"
              variant={mode === 'absolute' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('absolute')}
            >
              {t('sellerListings.bulkActions.priceChange.absoluteMode')}
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bulk-price-value">
              {mode === 'percent'
                ? t('sellerListings.bulkActions.priceChange.percentValueLabel')
                : t('sellerListings.bulkActions.priceChange.absoluteValueLabel')}
            </Label>
            <Input
              id="bulk-price-value"
              type="number"
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={mode === 'percent' ? 'e.g. -10 or 5' : 'e.g. -50 or 20'}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="cta" disabled={busy || (scopeType === 'brand' && !brand.trim())} onClick={handleSubmit}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            {t('sellerListings.bulkActions.priceChange.apply')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function StockUpdateDialog({ listingIds, onComplete }: { listingIds: string[]; onComplete: () => void }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'set' | 'delta'>('set')
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit() {
    const numericValue = Number(value)
    if (!Number.isInteger(numericValue)) {
      toast.error(t('sellerListings.bulkActions.stockUpdate.invalidValue'))
      return
    }
    setBusy(true)
    try {
      const result = await bulkStockUpdate({ listingIds, mode, value: numericValue })
      toast.success(
        t('sellerListings.bulkActions.stockUpdate.success', {
          updated: result.updatedListingIds.length,
          failed: result.failedListingIds.length,
        }),
      )
      setOpen(false)
      setValue('')
      onComplete()
    } catch {
      toast.error(t('common.somethingWentWrong'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Boxes className="h-4 w-4" aria-hidden="true" />
          {t('sellerListings.bulkActions.stockUpdate.trigger')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('sellerListings.bulkActions.stockUpdate.title')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex gap-2">
            <Button type="button" variant={mode === 'set' ? 'default' : 'outline'} size="sm" onClick={() => setMode('set')}>
              {t('sellerListings.bulkActions.stockUpdate.setMode')}
            </Button>
            <Button type="button" variant={mode === 'delta' ? 'default' : 'outline'} size="sm" onClick={() => setMode('delta')}>
              {t('sellerListings.bulkActions.stockUpdate.deltaMode')}
            </Button>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bulk-stock-value">
              {mode === 'set'
                ? t('sellerListings.bulkActions.stockUpdate.setValueLabel')
                : t('sellerListings.bulkActions.stockUpdate.deltaValueLabel')}
            </Label>
            <Input id="bulk-stock-value" type="number" inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="cta" disabled={busy} onClick={handleSubmit}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            {t('sellerListings.bulkActions.stockUpdate.apply')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function StatusChangeDialog({ listingIds, onComplete }: { listingIds: string[]; onComplete: () => void }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<'active' | 'paused' | 'archived'>('paused')
  const [busy, setBusy] = useState(false)

  async function handleSubmit() {
    setBusy(true)
    try {
      const result = await bulkStatusChange({ listingIds, status })
      toast.success(
        t('sellerListings.bulkActions.statusChange.success', {
          updated: result.updatedListingIds.length,
          failed: result.failedListingIds.length,
        }),
      )
      setOpen(false)
      onComplete()
    } catch {
      toast.error(t('common.somethingWentWrong'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <ToggleLeft className="h-4 w-4" aria-hidden="true" />
          {t('sellerListings.bulkActions.statusChange.trigger')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('sellerListings.bulkActions.statusChange.title')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="bulk-status-value">{t('sellerListings.bulkActions.statusChange.statusLabel')}</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as 'active' | 'paused' | 'archived')}>
            <SelectTrigger id="bulk-status-value">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">{t('sellerListings.status.active')}</SelectItem>
              <SelectItem value="paused">{t('sellerListings.status.paused')}</SelectItem>
              <SelectItem value="archived">{t('sellerListings.status.archived')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button type="button" variant="cta" disabled={busy} onClick={handleSubmit}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            {t('sellerListings.bulkActions.statusChange.apply')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
