import type { CmsPageType } from '@snapspare/shared'
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
import { saveCmsPage, useCmsPages } from '@/features/admin/api/contentActions'

const TYPES: CmsPageType[] = ['policy', 'faq', 'seo_landing']

/** Content module (design brief item 10): policy/FAQ/SEO landing pages. */
export function CmsPagesPanel() {
  const { t } = useTranslation()
  const { pages, loading } = useCmsPages()
  const [open, setOpen] = useState(false)
  const [slug, setSlug] = useState('')
  const [type, setType] = useState<CmsPageType>('policy')
  const [titleEn, setTitleEn] = useState('')
  const [titleHi, setTitleHi] = useState('')
  const [bodyEn, setBodyEn] = useState('')
  const [bodyHi, setBodyHi] = useState('')
  const [busy, setBusy] = useState(false)

  async function create(status: 'draft' | 'published') {
    setBusy(true)
    try {
      await saveCmsPage({
        slug: slug.trim(),
        type,
        title: { en: titleEn.trim(), hi: titleHi.trim() || titleEn.trim() },
        body: { en: bodyEn, hi: bodyHi || bodyEn },
        status,
      })
      toast.success(t('admin.content.pages.saveSuccess'))
      setOpen(false)
      setSlug('')
      setTitleEn('')
      setTitleHi('')
      setBodyEn('')
      setBodyHi('')
    } catch {
      toast.error(t('admin.content.pages.saveFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setOpen(true)}>
          {t('admin.content.pages.newAction')}
        </Button>
      </div>

      {loading ? (
        <Skeleton className="h-48 w-full" />
      ) : pages.length === 0 ? (
        <EmptyState title={t('admin.content.pages.emptyTitle')} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('admin.content.pages.slug')}</TableHead>
              <TableHead>{t('admin.content.pages.type')}</TableHead>
              <TableHead>{t('admin.content.pages.status')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pages.map((page) => (
              <TableRow key={page.id}>
                <TableCell className="font-mono text-xs">{page.slug}</TableCell>
                <TableCell className="text-xs text-steel">{page.type}</TableCell>
                <TableCell className="text-xs text-steel">{page.status}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.content.pages.newAction')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="cms-slug">{t('admin.content.pages.slug')}</Label>
                <Input id="cms-slug" value={slug} onChange={(e) => setSlug(e.target.value)} disabled={busy} />
              </div>
              <div>
                <Label htmlFor="cms-type">{t('admin.content.pages.type')}</Label>
                <select
                  id="cms-type"
                  className="flex min-h-tap w-full rounded-[6px] border border-steel/30 bg-surface px-3 text-sm text-ink"
                  value={type}
                  onChange={(e) => setType(e.target.value as CmsPageType)}
                  disabled={busy}
                >
                  {TYPES.map((t2) => (
                    <option key={t2} value={t2}>
                      {t2}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="cms-title-en">{t('admin.content.pages.titleEn')}</Label>
                <Input id="cms-title-en" value={titleEn} onChange={(e) => setTitleEn(e.target.value)} disabled={busy} />
              </div>
              <div>
                <Label htmlFor="cms-title-hi">{t('admin.content.pages.titleHi')}</Label>
                <Input id="cms-title-hi" value={titleHi} onChange={(e) => setTitleHi(e.target.value)} disabled={busy} />
              </div>
            </div>
            <div>
              <Label htmlFor="cms-body-en">{t('admin.content.pages.bodyEn')}</Label>
              <textarea
                id="cms-body-en"
                className="w-full rounded-[6px] border border-steel/30 bg-surface p-3 text-sm text-ink"
                rows={4}
                value={bodyEn}
                onChange={(e) => setBodyEn(e.target.value)}
                disabled={busy}
              />
            </div>
            <div>
              <Label htmlFor="cms-body-hi">{t('admin.content.pages.bodyHi')}</Label>
              <textarea
                id="cms-body-hi"
                className="w-full rounded-[6px] border border-steel/30 bg-surface p-3 text-sm text-ink"
                rows={4}
                value={bodyHi}
                onChange={(e) => setBodyHi(e.target.value)}
                disabled={busy}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={busy}>
              {t('common.close')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => create('draft')} disabled={busy || !slug.trim() || !titleEn.trim()}>
              {t('admin.content.pages.saveDraft')}
            </Button>
            <Button size="sm" onClick={() => create('published')} disabled={busy || !slug.trim() || !titleEn.trim()}>
              {t('admin.content.pages.publish')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
