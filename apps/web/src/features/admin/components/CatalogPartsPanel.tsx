import type { CatalogPart } from '@snapspare/shared'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/components/states/EmptyState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useCatalogParts } from '@/features/admin/api/catalogueActions'
import { CatalogPartFormDialog } from '@/features/admin/components/CatalogPartFormDialog'

export function CatalogPartsPanel() {
  const { t } = useTranslation()
  const { parts, loading } = useCatalogParts()
  const [searchTerm, setSearchTerm] = useState('')
  const [editing, setEditing] = useState<CatalogPart | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return parts
    return parts.filter(
      (part) => part.partNumber.toLowerCase().includes(term) || part.name.toLowerCase().includes(term) || part.oemNumbers.some((o) => o.toLowerCase().includes(term)),
    )
  }, [parts, searchTerm])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Input className="max-w-xs" placeholder={t('admin.catalogue.parts.searchPlaceholder')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        <Button
          size="sm"
          onClick={() => {
            setEditing(null)
            setDialogOpen(true)
          }}
        >
          {t('admin.catalogue.parts.newTitle')}
        </Button>
      </div>

      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : filtered.length === 0 ? (
        <EmptyState title={t('admin.catalogue.parts.emptyTitle')} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('admin.catalogue.parts.partNumber')}</TableHead>
              <TableHead>{t('admin.catalogue.parts.name')}</TableHead>
              <TableHead>{t('admin.catalogue.parts.categorySlug')}</TableHead>
              <TableHead>{t('admin.catalogue.parts.hsnCode')}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((part) => (
              <TableRow key={part.id}>
                <TableCell className="font-mono text-xs">{part.partNumber}</TableCell>
                <TableCell>{part.name}</TableCell>
                <TableCell className="text-xs text-steel">{part.categorySlug}</TableCell>
                <TableCell className="font-mono text-xs">{part.hsnCode}</TableCell>
                <TableCell>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditing(part)
                      setDialogOpen(true)
                    }}
                  >
                    {t('admin.catalogue.parts.edit')}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <CatalogPartFormDialog open={dialogOpen} onOpenChange={setDialogOpen} part={editing} onSaved={() => setEditing(null)} />
    </div>
  )
}
