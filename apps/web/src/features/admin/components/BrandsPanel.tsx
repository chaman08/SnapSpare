import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { EmptyState } from '@/components/states/EmptyState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { saveBrand, useBrands } from '@/features/admin/api/catalogueActions'

export function BrandsPanel() {
  const { t } = useTranslation()
  const { brands, loading } = useBrands()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [busy, setBusy] = useState(false)

  async function addBrand() {
    if (!name.trim() || !slug.trim()) return
    setBusy(true)
    try {
      await saveBrand({ name: name.trim(), slug: slug.trim(), authorizedOnly: false, status: 'active' })
      toast.success(t('admin.catalogue.brands.saveSuccess'))
      setName('')
      setSlug('')
    } catch {
      toast.error(t('admin.catalogue.brands.saveFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <Input placeholder={t('admin.catalogue.brands.name')} value={name} onChange={(e) => setName(e.target.value)} disabled={busy} />
        <Input placeholder={t('admin.catalogue.brands.slug')} value={slug} onChange={(e) => setSlug(e.target.value)} disabled={busy} />
        <Button size="sm" onClick={addBrand} disabled={busy || !name.trim() || !slug.trim()}>
          {t('admin.catalogue.brands.add')}
        </Button>
      </div>

      {loading ? (
        <Skeleton className="h-40 w-full" />
      ) : brands.length === 0 ? (
        <EmptyState title={t('admin.catalogue.brands.emptyTitle')} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('admin.catalogue.brands.name')}</TableHead>
              <TableHead>{t('admin.catalogue.brands.slug')}</TableHead>
              <TableHead>{t('admin.catalogue.brands.status')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {brands.map((brand) => (
              <TableRow key={brand.id}>
                <TableCell>{brand.name}</TableCell>
                <TableCell className="font-mono text-xs">{brand.slug}</TableCell>
                <TableCell className="text-xs text-steel">{brand.status}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
