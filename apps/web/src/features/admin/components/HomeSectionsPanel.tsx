import type { HomeSection, HomeSectionTrustIcon, HomeSectionType, SaveHomeSectionRequest } from '@snapspare/shared'
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'
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
import { reorderHomeSections, saveHomeSection, useHomeSections } from '@/features/admin/api/marketingActions'
import { cn } from '@/lib/utils'

const SECTION_TYPES: HomeSectionType[] = [
  'hero_banner',
  'vehicle_selector',
  'category_tiles',
  'deal_of_day',
  'bulk_buy_spotlight',
  'brand_rail',
  'recently_viewed',
  'reorder_rail',
  'trust_strip',
]

const TRUST_ICONS: HomeSectionTrustIcon[] = ['shield-check', 'file-check', 'rotate-ccw', 'banknote']

const DEFAULT_TRUST_ITEMS = [
  { icon: 'shield-check' as HomeSectionTrustIcon, labelEn: 'Genuine parts', labelHi: 'असली पार्ट्स' },
  { icon: 'file-check' as HomeSectionTrustIcon, labelEn: 'GST invoice', labelHi: 'जीएसटी चालान' },
  { icon: 'rotate-ccw' as HomeSectionTrustIcon, labelEn: 'Easy returns', labelHi: 'आसान रिटर्न' },
  { icon: 'banknote' as HomeSectionTrustIcon, labelEn: 'COD available', labelHi: 'सीओडी उपलब्ध' },
]

function toDateInputValue(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

function parseIdList(text: string): string[] {
  return text
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

interface CategoryTileRow {
  categorySlug: string
  labelEn: string
  labelHi: string
  imageUrl: string
}

interface TrustItemRow {
  icon: HomeSectionTrustIcon
  labelEn: string
  labelHi: string
}

/** Growth module's homepage-section builder (Phase 20 design brief item 1) — one doc per rail, ordered by `sortOrder`. */
export function HomeSectionsPanel() {
  const { t } = useTranslation()
  const { sections, loading } = useHomeSections()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const [type, setType] = useState<HomeSectionType>('hero_banner')
  const [titleEn, setTitleEn] = useState('')
  const [titleHi, setTitleHi] = useState('')
  const [categoryTiles, setCategoryTiles] = useState<CategoryTileRow[]>([])
  const [dealListingId, setDealListingId] = useState('')
  const [dealStart, setDealStart] = useState(toDateInputValue(Date.now()))
  const [dealEnd, setDealEnd] = useState(toDateInputValue(Date.now() + 24 * 60 * 60_000))
  const [maxItems, setMaxItems] = useState('12')
  const [pinnedListingIdsText, setPinnedListingIdsText] = useState('')
  const [brandIdsText, setBrandIdsText] = useState('')
  const [trustItems, setTrustItems] = useState<TrustItemRow[]>(DEFAULT_TRUST_ITEMS)

  function resetForm() {
    setType('hero_banner')
    setTitleEn('')
    setTitleHi('')
    setCategoryTiles([])
    setDealListingId('')
    setPinnedListingIdsText('')
    setBrandIdsText('')
    setTrustItems(DEFAULT_TRUST_ITEMS)
    setMaxItems('12')
  }

  function addCategoryTile() {
    setCategoryTiles((rows) => [...rows, { categorySlug: '', labelEn: '', labelHi: '', imageUrl: '' }])
  }

  function addTrustItem() {
    setTrustItems((rows) => [...rows, { icon: 'shield-check', labelEn: '', labelHi: '' }])
  }

  function buildRequest(): SaveHomeSectionRequest | null {
    const base = {
      title: titleEn.trim() && titleHi.trim() ? { en: titleEn.trim(), hi: titleHi.trim() } : undefined,
      sortOrder: sections.length,
      status: 'active' as const,
    }

    switch (type) {
      case 'hero_banner':
        return { ...base, type }
      case 'vehicle_selector':
        return { ...base, type }
      case 'category_tiles':
        if (categoryTiles.length === 0) return null
        return {
          ...base,
          type,
          items: categoryTiles.map((row) => ({
            categorySlug: row.categorySlug.trim(),
            label: { en: row.labelEn.trim(), hi: row.labelHi.trim() },
            imageUrl: row.imageUrl.trim(),
          })),
        }
      case 'deal_of_day':
        if (!dealListingId.trim()) return null
        return {
          ...base,
          type,
          listingId: dealListingId.trim(),
          startAt: new Date(dealStart).getTime(),
          endAt: new Date(dealEnd).getTime(),
        }
      case 'bulk_buy_spotlight':
        return {
          ...base,
          type,
          maxItems: Number(maxItems) || 12,
          pinnedListingIds: parseIdList(pinnedListingIdsText),
        }
      case 'brand_rail': {
        const brandIds = parseIdList(brandIdsText)
        if (brandIds.length === 0) return null
        return { ...base, type, brandIds }
      }
      case 'recently_viewed':
        return { ...base, type, maxItems: Number(maxItems) || 10 }
      case 'reorder_rail':
        return { ...base, type, maxItems: Number(maxItems) || 5 }
      case 'trust_strip':
        if (trustItems.length === 0) return null
        return {
          ...base,
          type,
          items: trustItems.map((row) => ({ icon: row.icon, label: { en: row.labelEn.trim(), hi: row.labelHi.trim() } })),
        }
      default:
        return null
    }
  }

  async function create() {
    const request = buildRequest()
    if (!request) {
      toast.error(t('admin.marketing.homeSections.incompleteForm'))
      return
    }
    setBusy(true)
    try {
      await saveHomeSection(request)
      toast.success(t('admin.marketing.homeSections.saveSuccess'))
      setOpen(false)
      resetForm()
    } catch {
      toast.error(t('admin.marketing.homeSections.saveFailed'))
    } finally {
      setBusy(false)
    }
  }

  async function toggleStatus(section: HomeSection) {
    const { id, createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = section
    try {
      await saveHomeSection({ ...rest, id, status: rest.status === 'active' ? 'inactive' : 'active' } as SaveHomeSectionRequest)
    } catch {
      toast.error(t('admin.marketing.homeSections.saveFailed'))
    }
  }

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= sections.length) return
    const orderedIds = sections.map((s) => s.id)
    ;[orderedIds[index], orderedIds[target]] = [orderedIds[target] as string, orderedIds[index] as string]
    try {
      await reorderHomeSections({ orderedIds })
    } catch {
      toast.error(t('admin.marketing.homeSections.reorderFailed'))
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setOpen(true)}>
          {t('admin.marketing.homeSections.newAction')}
        </Button>
      </div>

      {loading ? (
        <Skeleton className="h-48 w-full" />
      ) : sections.length === 0 ? (
        <EmptyState title={t('admin.marketing.homeSections.emptyTitle')} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('admin.marketing.homeSections.order')}</TableHead>
              <TableHead>{t('admin.marketing.homeSections.type')}</TableHead>
              <TableHead>{t('admin.marketing.homeSections.title')}</TableHead>
              <TableHead>{t('admin.marketing.homeSections.status')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sections.map((section, index) => (
              <TableRow key={section.id}>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => move(index, -1)}
                      disabled={index === 0}
                      aria-label={t('admin.marketing.homeSections.moveUp')}
                      className="flex min-h-tap min-w-tap items-center justify-center rounded-[6px] text-steel hover:bg-surface-muted disabled:opacity-30"
                    >
                      <ChevronUp className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(index, 1)}
                      disabled={index === sections.length - 1}
                      aria-label={t('admin.marketing.homeSections.moveDown')}
                      className="flex min-h-tap min-w-tap items-center justify-center rounded-[6px] text-steel hover:bg-surface-muted disabled:opacity-30"
                    >
                      <ChevronDown className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs">{section.type}</TableCell>
                <TableCell className="text-xs text-steel">{section.title?.en ?? '—'}</TableCell>
                <TableCell>
                  <button
                    type="button"
                    onClick={() => toggleStatus(section)}
                    className={cn(
                      'min-h-tap rounded-full px-2 py-0.5 text-xs font-medium',
                      section.status === 'active' ? 'bg-verify/10 text-verify' : 'bg-steel/10 text-steel',
                    )}
                  >
                    {section.status}
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('admin.marketing.homeSections.newAction')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="home-section-type">{t('admin.marketing.homeSections.type')}</Label>
              <select
                id="home-section-type"
                className="flex min-h-tap w-full rounded-[6px] border border-steel/30 bg-surface px-3 text-sm text-ink"
                value={type}
                onChange={(e) => setType(e.target.value as HomeSectionType)}
                disabled={busy}
              >
                {SECTION_TYPES.map((sectionType) => (
                  <option key={sectionType} value={sectionType}>
                    {t(`admin.marketing.homeSections.typeLabel.${sectionType}`)}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="home-section-title-en">{t('admin.marketing.homeSections.titleEn')}</Label>
                <Input id="home-section-title-en" value={titleEn} onChange={(e) => setTitleEn(e.target.value)} disabled={busy} />
              </div>
              <div>
                <Label htmlFor="home-section-title-hi">{t('admin.marketing.homeSections.titleHi')}</Label>
                <Input id="home-section-title-hi" value={titleHi} onChange={(e) => setTitleHi(e.target.value)} disabled={busy} />
              </div>
            </div>

            {type === 'hero_banner' || type === 'vehicle_selector' ? (
              <p className="text-xs text-steel">{t(`admin.marketing.homeSections.helper.${type}`)}</p>
            ) : null}

            {type === 'category_tiles' ? (
              <div className="space-y-2">
                {categoryTiles.map((row, index) => (
                  <div key={index} className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-1.5">
                    <Input
                      placeholder={t('admin.marketing.homeSections.categorySlug')}
                      value={row.categorySlug}
                      onChange={(e) =>
                        setCategoryTiles((rows) => rows.map((r, i) => (i === index ? { ...r, categorySlug: e.target.value } : r)))
                      }
                      disabled={busy}
                    />
                    <Input
                      placeholder={t('admin.marketing.homeSections.titleEn')}
                      value={row.labelEn}
                      onChange={(e) => setCategoryTiles((rows) => rows.map((r, i) => (i === index ? { ...r, labelEn: e.target.value } : r)))}
                      disabled={busy}
                    />
                    <Input
                      placeholder={t('admin.marketing.homeSections.titleHi')}
                      value={row.labelHi}
                      onChange={(e) => setCategoryTiles((rows) => rows.map((r, i) => (i === index ? { ...r, labelHi: e.target.value } : r)))}
                      disabled={busy}
                    />
                    <Input
                      placeholder={t('admin.marketing.homeSections.imageUrl')}
                      value={row.imageUrl}
                      onChange={(e) => setCategoryTiles((rows) => rows.map((r, i) => (i === index ? { ...r, imageUrl: e.target.value } : r)))}
                      disabled={busy}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setCategoryTiles((rows) => rows.filter((_, i) => i !== index))}
                      disabled={busy}
                      aria-label={t('common.remove')}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addCategoryTile} disabled={busy}>
                  <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
                  {t('admin.marketing.homeSections.addTile')}
                </Button>
              </div>
            ) : null}

            {type === 'deal_of_day' ? (
              <div className="space-y-2">
                <div>
                  <Label htmlFor="home-section-deal-listing">{t('admin.marketing.homeSections.listingId')}</Label>
                  <Input id="home-section-deal-listing" value={dealListingId} onChange={(e) => setDealListingId(e.target.value)} disabled={busy} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="home-section-deal-start">{t('admin.marketing.banners.startAt')}</Label>
                    <Input id="home-section-deal-start" type="date" value={dealStart} onChange={(e) => setDealStart(e.target.value)} disabled={busy} />
                  </div>
                  <div>
                    <Label htmlFor="home-section-deal-end">{t('admin.marketing.banners.endAt')}</Label>
                    <Input id="home-section-deal-end" type="date" value={dealEnd} onChange={(e) => setDealEnd(e.target.value)} disabled={busy} />
                  </div>
                </div>
              </div>
            ) : null}

            {type === 'bulk_buy_spotlight' ? (
              <div className="space-y-2">
                <div>
                  <Label htmlFor="home-section-max-items">{t('admin.marketing.homeSections.maxItems')}</Label>
                  <Input id="home-section-max-items" type="number" min={1} max={20} value={maxItems} onChange={(e) => setMaxItems(e.target.value)} disabled={busy} />
                </div>
                <div>
                  <Label htmlFor="home-section-pinned">{t('admin.marketing.homeSections.pinnedListingIds')}</Label>
                  <Input id="home-section-pinned" value={pinnedListingIdsText} onChange={(e) => setPinnedListingIdsText(e.target.value)} disabled={busy} />
                </div>
              </div>
            ) : null}

            {type === 'brand_rail' ? (
              <div>
                <Label htmlFor="home-section-brands">{t('admin.marketing.homeSections.brandIds')}</Label>
                <Input id="home-section-brands" value={brandIdsText} onChange={(e) => setBrandIdsText(e.target.value)} disabled={busy} />
              </div>
            ) : null}

            {type === 'recently_viewed' || type === 'reorder_rail' ? (
              <div>
                <Label htmlFor="home-section-max-items-2">{t('admin.marketing.homeSections.maxItems')}</Label>
                <Input id="home-section-max-items-2" type="number" min={1} max={20} value={maxItems} onChange={(e) => setMaxItems(e.target.value)} disabled={busy} />
              </div>
            ) : null}

            {type === 'trust_strip' ? (
              <div className="space-y-2">
                {trustItems.map((row, index) => (
                  <div key={index} className="grid grid-cols-[auto_1fr_1fr_auto] gap-1.5">
                    <select
                      className="flex min-h-tap rounded-[6px] border border-steel/30 bg-surface px-2 text-sm text-ink"
                      value={row.icon}
                      onChange={(e) =>
                        setTrustItems((rows) => rows.map((r, i) => (i === index ? { ...r, icon: e.target.value as HomeSectionTrustIcon } : r)))
                      }
                      disabled={busy}
                    >
                      {TRUST_ICONS.map((icon) => (
                        <option key={icon} value={icon}>
                          {icon}
                        </option>
                      ))}
                    </select>
                    <Input
                      placeholder={t('admin.marketing.homeSections.titleEn')}
                      value={row.labelEn}
                      onChange={(e) => setTrustItems((rows) => rows.map((r, i) => (i === index ? { ...r, labelEn: e.target.value } : r)))}
                      disabled={busy}
                    />
                    <Input
                      placeholder={t('admin.marketing.homeSections.titleHi')}
                      value={row.labelHi}
                      onChange={(e) => setTrustItems((rows) => rows.map((r, i) => (i === index ? { ...r, labelHi: e.target.value } : r)))}
                      disabled={busy}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setTrustItems((rows) => rows.filter((_, i) => i !== index))}
                      disabled={busy}
                      aria-label={t('common.remove')}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addTrustItem} disabled={busy}>
                  <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
                  {t('admin.marketing.homeSections.addTile')}
                </Button>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={busy}>
              {t('common.close')}
            </Button>
            <Button size="sm" onClick={create} disabled={busy}>
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
