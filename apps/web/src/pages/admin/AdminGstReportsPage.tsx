import { formatINR } from '@snapspare/shared'
import { type ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  downloadCsv,
  exportEwayBillTasksAdmin,
  getGmvTaxReport,
  getGstr1SummaryReport,
  getTcsSummaryReport,
  getTdsSummaryReport,
} from '@/features/admin/api/taxReportActions'

function currentMonthValue(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function currentFinancialYearLabel(): string {
  const now = new Date()
  const month = now.getMonth() // 0-11
  const startYear = month >= 3 ? now.getFullYear() : now.getFullYear() - 1
  return `FY${String(startYear % 100).padStart(2, '0')}-${String((startYear + 1) % 100).padStart(2, '0')}`
}

/**
 * Admin-only GST compliance reports (design brief item 7): GSTR-1-style
 * outward-supply summary, TCS summary (GSTR-8 reconciliation), TDS summary
 * (Section 194-O, quarterly), monthly GMV + tax collected, and e-way-bill
 * tasks — every one of them exportable as CSV. Each card fetches on demand
 * (these scan a month/quarter of invoices — not something to run on every
 * page load) and downloads immediately once the data's back.
 */
export default function AdminGstReportsPage() {
  const { t } = useTranslation()
  const [month, setMonth] = useState(currentMonthValue())
  const [financialYear, setFinancialYear] = useState(currentFinancialYearLabel())
  const [quarter, setQuarter] = useState<'Q1' | 'Q2' | 'Q3' | 'Q4'>('Q1')
  const [loadingKey, setLoadingKey] = useState<string | null>(null)
  const [gmvSummary, setGmvSummary] = useState<{ gmvPaise: number; taxPaise: number; tcsPaise: number } | null>(null)

  async function run(key: string, action: () => Promise<void>) {
    setLoadingKey(key)
    try {
      await action()
    } catch {
      toast.error(t('admin.gstReports.errors.generic'))
    } finally {
      setLoadingKey(null)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
      <h1 className="font-heading text-2xl font-semibold text-ink">{t('admin.gstReports.title')}</h1>
      <p className="text-sm text-steel">{t('admin.gstReports.subtitle')}</p>

      <div className="flex flex-wrap items-end gap-4 rounded-[6px] border border-steel/20 p-4">
        <div>
          <Label htmlFor="gst-report-month">{t('admin.gstReports.month')}</Label>
          <Input id="gst-report-month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <ReportCard
          title={t('admin.gstReports.gstr1.title')}
          description={t('admin.gstReports.gstr1.description')}
          loading={loadingKey === 'gstr1'}
          onRun={() =>
            run('gstr1', async () => {
              const result = await getGstr1SummaryReport({ month })
              downloadCsv(result.csv, `gstr1-summary-${month}.csv`)
              toast.success(t('admin.gstReports.downloaded', { count: result.rows.length }))
            })
          }
        />
        <ReportCard
          title={t('admin.gstReports.tcs.title')}
          description={t('admin.gstReports.tcs.description')}
          loading={loadingKey === 'tcs'}
          onRun={() =>
            run('tcs', async () => {
              const result = await getTcsSummaryReport({ month })
              downloadCsv(result.csv, `tcs-summary-${month}.csv`)
              toast.success(t('admin.gstReports.downloaded', { count: result.rows.length }))
            })
          }
        />
        <ReportCard
          title={t('admin.gstReports.gmv.title')}
          description={t('admin.gstReports.gmv.description')}
          loading={loadingKey === 'gmv'}
          onRun={() =>
            run('gmv', async () => {
              const result = await getGmvTaxReport({ month })
              downloadCsv(result.csv, `gmv-tax-${month}.csv`)
              setGmvSummary({ gmvPaise: result.gmvPaise, taxPaise: result.cgstPaise + result.sgstPaise + result.igstPaise, tcsPaise: result.tcsPaise })
            })
          }
        >
          {gmvSummary ? (
            <dl className="mt-2 grid grid-cols-3 gap-2 text-xs text-steel">
              <div>
                <dt>{t('admin.gstReports.gmv.gmv')}</dt>
                <dd className="font-mono text-ink">{formatINR(gmvSummary.gmvPaise)}</dd>
              </div>
              <div>
                <dt>{t('admin.gstReports.gmv.tax')}</dt>
                <dd className="font-mono text-ink">{formatINR(gmvSummary.taxPaise)}</dd>
              </div>
              <div>
                <dt>{t('admin.gstReports.gmv.tcs')}</dt>
                <dd className="font-mono text-ink">{formatINR(gmvSummary.tcsPaise)}</dd>
              </div>
            </dl>
          ) : null}
        </ReportCard>
        <ReportCard
          title={t('admin.gstReports.ewayBill.title')}
          description={t('admin.gstReports.ewayBill.description')}
          loading={loadingKey === 'ewayBill'}
          onRun={() =>
            run('ewayBill', async () => {
              const result = await exportEwayBillTasksAdmin({ status: 'pending' })
              downloadCsv(result.csv, 'eway-bill-tasks-pending.csv')
              toast.success(t('admin.gstReports.downloaded', { count: result.rowCount }))
            })
          }
        />
      </div>

      <div className="rounded-[6px] border border-steel/20 p-4">
        <h2 className="font-heading text-lg font-semibold text-ink">{t('admin.gstReports.tds.title')}</h2>
        <p className="text-sm text-steel">{t('admin.gstReports.tds.description')}</p>
        <div className="mt-3 flex flex-wrap items-end gap-4">
          <div>
            <Label htmlFor="tds-fy">{t('admin.gstReports.tds.financialYear')}</Label>
            <Input
              id="tds-fy"
              value={financialYear}
              onChange={(e) => setFinancialYear(e.target.value)}
              placeholder="FY26-27"
              className="w-32"
            />
          </div>
          <div>
            <Label htmlFor="tds-quarter">{t('admin.gstReports.tds.quarter')}</Label>
            <select
              id="tds-quarter"
              value={quarter}
              onChange={(e) => setQuarter(e.target.value as 'Q1' | 'Q2' | 'Q3' | 'Q4')}
              className="h-10 rounded-[6px] border border-steel/30 bg-surfaces px-3 text-sm"
            >
              {(['Q1', 'Q2', 'Q3', 'Q4'] as const).map((q) => (
                <option key={q} value={q}>
                  {q}
                </option>
              ))}
            </select>
          </div>
          <Button
            type="button"
            variant="cta"
            disabled={loadingKey === 'tds'}
            onClick={() =>
              run('tds', async () => {
                const result = await getTdsSummaryReport({ financialYear, quarter })
                downloadCsv(result.csv, `tds-summary-${financialYear}-${quarter}.csv`)
                toast.success(t('admin.gstReports.downloaded', { count: result.rows.length }))
              })
            }
          >
            {loadingKey === 'tds' ? t('common.loading') : t('admin.gstReports.tds.generate')}
          </Button>
        </div>
      </div>
    </div>
  )
}

interface ReportCardProps {
  title: string
  description: string
  loading: boolean
  onRun: () => void
  children?: ReactNode
}

function ReportCard({ title, description, loading, onRun, children }: ReportCardProps) {
  const { t } = useTranslation()
  return (
    <div className="rounded-[6px] border border-steel/20 p-4">
      <h2 className="font-heading text-lg font-semibold text-ink">{title}</h2>
      <p className="text-sm text-steel">{description}</p>
      <Button type="button" variant="outline" size="sm" className="mt-3" disabled={loading} onClick={onRun}>
        {loading ? t('common.loading') : t('admin.gstReports.exportCsv')}
      </Button>
      {children}
    </div>
  )
}
