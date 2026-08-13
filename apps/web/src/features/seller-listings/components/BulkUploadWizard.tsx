import type { BulkUploadJob } from '@snapspare/shared'
import { Download, FileSpreadsheet, Loader2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  commitBulkListingUpload,
  getBulkUploadErrorReportUrl,
  getBulkUploadJob,
  parseBulkListingUpload,
  uploadBulkUploadFile,
} from '@/features/seller-listings/api/bulkUpload'
import { buildBulkUploadTemplateWorkbook, downloadBlob } from '@/features/seller-listings/lib/bulkUploadTemplate'

type WizardStep = 'idle' | 'uploading' | 'reviewing' | 'committing' | 'committed'

interface BulkUploadWizardProps {
  sellerId: string
  onCommitted?: () => void
}

/** Requirement 4's full bulk-upload flow: download template → upload → server-side parse → preview-before-commit → commit only valid rows → downloadable error report for the rest. */
export function BulkUploadWizard({ sellerId, onCommitted }: BulkUploadWizardProps) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<WizardStep>('idle')
  const [job, setJob] = useState<BulkUploadJob | undefined>(undefined)
  const [errorReportUrl, setErrorReportUrl] = useState<string | undefined>(undefined)

  async function handleDownloadTemplate() {
    const blob = await buildBulkUploadTemplateWorkbook()
    downloadBlob(blob, 'snapspare-bulk-listing-template.xlsx')
  }

  async function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setStep('uploading')
    setErrorReportUrl(undefined)
    try {
      const storagePath = await uploadBulkUploadFile(sellerId, file)
      const result = await parseBulkListingUpload({ storagePath })
      const parsedJob = await getBulkUploadJob(result.jobId)
      setJob(parsedJob)
      setStep('reviewing')
    } catch {
      toast.error(t('sellerListings.bulkUpload.parseError'))
      setStep('idle')
    } finally {
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function handleCommit() {
    if (!job) return
    setStep('committing')
    try {
      const result = await commitBulkListingUpload({ jobId: job.id })
      if (result.errorReportStoragePath) {
        setErrorReportUrl(await getBulkUploadErrorReportUrl(result.errorReportStoragePath))
      }
      const committedJob = await getBulkUploadJob(job.id)
      setJob(committedJob)
      setStep('committed')
      toast.success(t('sellerListings.bulkUpload.commitSuccess', { count: result.committedRows }))
      onCommitted?.()
    } catch {
      toast.error(t('sellerListings.bulkUpload.commitError'))
      setStep('reviewing')
    }
  }

  function handleStartOver() {
    setJob(undefined)
    setErrorReportUrl(undefined)
    setStep('idle')
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[6px] border border-steel/20 bg-surface p-4">
        <h2 className="font-heading text-lg font-semibold text-ink">{t('sellerListings.bulkUpload.title')}</h2>
        <p className="mt-1 text-sm text-steel">{t('sellerListings.bulkUpload.description')}</p>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleDownloadTemplate}>
            <Download className="h-4 w-4" aria-hidden="true" />
            {t('sellerListings.bulkUpload.downloadTemplate')}
          </Button>

          {step === 'idle' || step === 'uploading' ? (
            <>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,.xlsx"
                className="sr-only"
                onChange={handleFileSelected}
                aria-label={t('sellerListings.bulkUpload.uploadAction')}
              />
              <Button
                type="button"
                variant="cta"
                size="sm"
                disabled={step === 'uploading'}
                onClick={() => inputRef.current?.click()}
              >
                {step === 'uploading' ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
                )}
                {step === 'uploading' ? t('sellerListings.bulkUpload.parsing') : t('sellerListings.bulkUpload.uploadAction')}
              </Button>
            </>
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={handleStartOver}>
              {t('sellerListings.bulkUpload.startOver')}
            </Button>
          )}
        </div>
      </div>

      {job && (step === 'reviewing' || step === 'committing' || step === 'committed') ? (
        <div className="space-y-3" aria-live="polite">
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="text-ink">
              {t('sellerListings.bulkUpload.summaryTotal', { count: job.totalRows })}
            </span>
            <span className="text-verify">
              {t('sellerListings.bulkUpload.summaryValid', { count: job.validRows })}
            </span>
            {job.invalidRows > 0 ? (
              <span className="text-alert">{t('sellerListings.bulkUpload.summaryInvalid', { count: job.invalidRows })}</span>
            ) : null}
            {step === 'committed' ? (
              <span className="font-medium text-ink">
                {t('sellerListings.bulkUpload.summaryCommitted', { count: job.committedRows })}
              </span>
            ) : null}
          </div>

          {errorReportUrl ? (
            <a
              href={errorReportUrl}
              download
              className="inline-flex min-h-tap items-center gap-1.5 text-sm font-medium text-signal underline underline-offset-2"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              {t('sellerListings.bulkUpload.downloadErrorReport')}
            </a>
          ) : null}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('sellerListings.bulkUpload.table.row')}</TableHead>
                <TableHead>{t('sellerListings.bulkUpload.table.sku')}</TableHead>
                <TableHead>{t('sellerListings.bulkUpload.table.status')}</TableHead>
                <TableHead>{t('sellerListings.bulkUpload.table.reason')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {job.rows.map((row) => (
                <TableRow key={row.rowNumber}>
                  <TableCell className="font-mono">{row.rowNumber}</TableCell>
                  <TableCell className="font-mono text-xs">{row.sku ?? '—'}</TableCell>
                  <TableCell>
                    <span className={row.valid ? 'text-verify' : 'text-alert'}>
                      {row.valid
                        ? t('sellerListings.bulkUpload.table.valid')
                        : t('sellerListings.bulkUpload.table.invalid')}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-steel">{row.errors.join('; ') || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {step === 'reviewing' ? (
            <Button type="button" variant="cta" size="sm" disabled={job.validRows === 0} onClick={handleCommit}>
              {t('sellerListings.bulkUpload.commitAction', { count: job.validRows })}
            </Button>
          ) : null}
          {step === 'committing' ? (
            <Button type="button" variant="cta" size="sm" disabled>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              {t('sellerListings.bulkUpload.committing')}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
