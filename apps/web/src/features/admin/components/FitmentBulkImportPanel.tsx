import type { CatalogFitmentBulkImportRow, CatalogFitmentBulkImportRowResult } from '@snapspare/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { bulkImportCatalogFitments } from '@/features/admin/api/fitmentActions'
import { parseCsvWithHeader } from '@/lib/csv'
import { cn } from '@/lib/utils'

const STATUS_STYLES: Record<string, string> = { ok: 'text-verify', conflict: 'text-alert', error: 'text-alert' }

function rowsFromCsv(text: string): CatalogFitmentBulkImportRow[] {
  return parseCsvWithHeader(text).map((record, index) => ({
    rowNumber: index + 2,
    partId: record.partId ?? '',
    makeId: record.makeId ?? '',
    modelId: record.modelId ?? '',
    variantId: record.variantId || undefined,
    yearFrom: record.yearFrom ? Number(record.yearFrom) : undefined,
    yearTo: record.yearTo ? Number(record.yearTo) : undefined,
    notes: record.notes || undefined,
  }))
}

/** Fitment workbench's bulk CSV import (design brief item 4). Expected header: partId,makeId,modelId,variantId,yearFrom,yearTo,notes. */
export function FitmentBulkImportPanel() {
  const { t } = useTranslation()
  const [rows, setRows] = useState<CatalogFitmentBulkImportRow[]>([])
  const [results, setResults] = useState<CatalogFitmentBulkImportRowResult[]>([])
  const [busy, setBusy] = useState(false)
  const [committed, setCommitted] = useState(false)

  async function handleFile(file: File) {
    const text = await file.text()
    const parsedRows = rowsFromCsv(text)
    setRows(parsedRows)
    setCommitted(false)
    setBusy(true)
    try {
      const result = await bulkImportCatalogFitments({ rows: parsedRows, commit: false })
      setResults(result.rows)
    } catch {
      toast.error(t('admin.fitment.bulkImport.parseFailed'))
    } finally {
      setBusy(false)
    }
  }

  async function commit() {
    setBusy(true)
    try {
      const result = await bulkImportCatalogFitments({ rows, commit: true })
      setResults(result.rows)
      setCommitted(true)
      toast.success(t('admin.fitment.bulkImport.commitSuccess', { count: result.createdCount }))
    } catch {
      toast.error(t('admin.fitment.bulkImport.commitFailed'))
    } finally {
      setBusy(false)
    }
  }

  const okCount = results.filter((r) => r.status === 'ok').length

  return (
    <div className="space-y-4">
      <p className="text-sm text-steel">{t('admin.fitment.bulkImport.instructions')}</p>
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
                <TableHead>{t('admin.fitment.partId')}</TableHead>
                <TableHead>{t('admin.catalogue.bulkImport.status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((result) => (
                <TableRow key={result.rowNumber}>
                  <TableCell className="font-mono text-xs">{result.rowNumber}</TableCell>
                  <TableCell className="font-mono text-xs">{rows.find((r) => r.rowNumber === result.rowNumber)?.partId}</TableCell>
                  <TableCell className={cn('text-xs font-medium', STATUS_STYLES[result.status])}>
                    {t(`admin.fitment.bulkImport.rowStatus.${result.status}`)}
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
