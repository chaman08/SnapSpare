import type { CatalogPartBulkImportRow, CatalogPartBulkImportRowResult, GstRatePercent } from '@snapspare/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { bulkImportCatalogParts } from '@/features/admin/api/catalogueActions'
import { parseCsvWithHeader } from '@/lib/csv'
import { cn } from '@/lib/utils'

const STATUS_STYLES: Record<string, string> = {
  ok: 'text-verify',
  duplicate: 'text-alert',
  error: 'text-alert',
}

function rowsFromCsv(text: string): CatalogPartBulkImportRow[] {
  return parseCsvWithHeader(text).map((record, index) => ({
    rowNumber: index + 2, // header is row 1
    partNumber: record.partNumber ?? '',
    name: record.name ?? '',
    categorySlug: record.categorySlug ?? '',
    subcategorySlug: record.subcategorySlug || undefined,
    brand: record.brand || undefined,
    hsnCode: record.hsnCode ?? '',
    gstRatePercent: (Number(record.gstRatePercent) || 0) as GstRatePercent,
    oemNumbers: (record.oemNumbers ?? '').split(';').map((s) => s.trim()).filter(Boolean),
  }))
}

/**
 * Catalogue module's bulk CSV import (design brief item 3). Expected header
 * row: partNumber,name,categorySlug,subcategorySlug,brand,hsnCode,
 * gstRatePercent,oemNumbers (oemNumbers semicolon-separated). Parses
 * entirely client-side, then calls bulkImportCatalogParts twice: once as a
 * dry run to preview/flag duplicates, once (on confirm) to commit.
 */
export function CatalogueBulkImportPanel() {
  const { t } = useTranslation()
  const [rows, setRows] = useState<CatalogPartBulkImportRow[]>([])
  const [results, setResults] = useState<CatalogPartBulkImportRowResult[]>([])
  const [busy, setBusy] = useState(false)
  const [committed, setCommitted] = useState(false)

  async function handleFile(file: File) {
    const text = await file.text()
    const parsedRows = rowsFromCsv(text)
    setRows(parsedRows)
    setCommitted(false)
    setBusy(true)
    try {
      const result = await bulkImportCatalogParts({ rows: parsedRows, commit: false })
      setResults(result.rows)
    } catch {
      toast.error(t('admin.catalogue.bulkImport.parseFailed'))
    } finally {
      setBusy(false)
    }
  }

  async function commit() {
    setBusy(true)
    try {
      const result = await bulkImportCatalogParts({ rows, commit: true })
      setResults(result.rows)
      setCommitted(true)
      toast.success(t('admin.catalogue.bulkImport.commitSuccess', { count: result.createdCount }))
    } catch {
      toast.error(t('admin.catalogue.bulkImport.commitFailed'))
    } finally {
      setBusy(false)
    }
  }

  const okCount = results.filter((r) => r.status === 'ok').length

  return (
    <div className="space-y-4">
      <p className="text-sm text-steel">{t('admin.catalogue.bulkImport.instructions')}</p>
      <input
        type="file"
        accept=".csv,text/csv"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void handleFile(file)
        }}
        disabled={busy}
      />

      {results.length > 0 && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('admin.catalogue.bulkImport.row')}</TableHead>
                <TableHead>{t('admin.catalogue.parts.partNumber')}</TableHead>
                <TableHead>{t('admin.catalogue.bulkImport.status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((result) => (
                <TableRow key={result.rowNumber}>
                  <TableCell className="font-mono text-xs">{result.rowNumber}</TableCell>
                  <TableCell className="font-mono text-xs">{rows.find((r) => r.rowNumber === result.rowNumber)?.partNumber}</TableCell>
                  <TableCell className={cn('text-xs font-medium', STATUS_STYLES[result.status])}>
                    {t(`admin.catalogue.bulkImport.rowStatus.${result.status}`)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {!committed && (
            <Button onClick={commit} disabled={busy || okCount === 0}>
              {t('admin.catalogue.bulkImport.commitAction', { count: okCount })}
            </Button>
          )}
        </>
      )}
    </div>
  )
}
