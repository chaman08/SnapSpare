import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { EmptyState } from '@/components/states/EmptyState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { saveCategory, useCategories } from '@/features/admin/api/catalogueActions'

export function CategoriesPanel() {
  const { t } = useTranslation()
  const { categories, loading } = useCategories()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [busy, setBusy] = useState(false)

  async function addCategory() {
    if (!name.trim() || !slug.trim()) return
    setBusy(true)
    try {
      await saveCategory({ name: name.trim(), slug: slug.trim(), status: 'active' })
      toast.success(t('admin.catalogue.categories.saveSuccess'))
      setName('')
      setSlug('')
    } catch {
      toast.error(t('admin.catalogue.categories.saveFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <Input placeholder={t('admin.catalogue.categories.name')} value={name} onChange={(e) => setName(e.target.value)} disabled={busy} />
        <Input placeholder={t('admin.catalogue.categories.slug')} value={slug} onChange={(e) => setSlug(e.target.value)} disabled={busy} />
        <Button size="sm" onClick={addCategory} disabled={busy || !name.trim() || !slug.trim()}>
          {t('admin.catalogue.categories.add')}
        </Button>
      </div>

      {loading ? (
        <Skeleton className="h-40 w-full" />
      ) : categories.length === 0 ? (
        <EmptyState title={t('admin.catalogue.categories.emptyTitle')} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('admin.catalogue.categories.name')}</TableHead>
              <TableHead>{t('admin.catalogue.categories.slug')}</TableHead>
              <TableHead>{t('admin.catalogue.categories.status')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((category) => (
              <TableRow key={category.id}>
                <TableCell>{category.name}</TableCell>
                <TableCell className="font-mono text-xs">{category.slug}</TableCell>
                <TableCell className="text-xs text-steel">{category.status}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
