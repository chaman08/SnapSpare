import type { SpuriousReport, SpuriousReportOutcome } from '@snapspare/shared'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { resolveSpuriousReport } from '@/features/admin/api/spuriousReportActions'
import { getSpuriousReportEvidenceUrls } from '@/features/trust/api/spuriousReportActions'

const OUTCOMES: SpuriousReportOutcome[] = ['warning', 'listing_removal', 'category_ban', 'payout_hold', 'delisting', 'dismissed']

interface SpuriousReportPanelProps {
  report: SpuriousReport
}

export function SpuriousReportPanel({ report }: SpuriousReportPanelProps) {
  const { t } = useTranslation()
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>([])
  const [outcome, setOutcome] = useState<SpuriousReportOutcome>('warning')
  const [adminNotes, setAdminNotes] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (report.evidenceImages.length === 0) return
    getSpuriousReportEvidenceUrls(report.id)
      .then(setEvidenceUrls)
      .catch(() => undefined)
  }, [report.id, report.evidenceImages.length])

  async function handleStartReview() {
    setBusy(true)
    try {
      await resolveSpuriousReport({ id: report.id, action: 'start_review' })
      toast.success(t('admin.spuriousReports.action.startReviewSuccess'))
    } catch {
      toast.error(t('admin.spuriousReports.actionFailed'))
    } finally {
      setBusy(false)
    }
  }

  async function handleResolve() {
    setBusy(true)
    try {
      await resolveSpuriousReport({ id: report.id, action: 'resolve', outcome, adminNotes: adminNotes.trim() || undefined })
      toast.success(t('admin.spuriousReports.action.resolveSuccess'))
    } catch {
      toast.error(t('admin.spuriousReports.actionFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-3 rounded-[6px] border border-steel/20 p-4 sm:grid-cols-3">
        <div>
          <dt className="text-xs text-steel">{t('admin.spuriousReports.listingLabel')}</dt>
          <dd className="font-mono text-sm text-ink">{report.listingId}</dd>
        </div>
        <div>
          <dt className="text-xs text-steel">{t('admin.spuriousReports.sellerLabel')}</dt>
          <dd className="font-mono text-sm text-ink">{report.sellerId}</dd>
        </div>
        <div>
          <dt className="text-xs text-steel">{t('admin.spuriousReports.statusLabel')}</dt>
          <dd className="text-sm text-ink">{t(`admin.spuriousReports.status.${report.status}`)}</dd>
        </div>
      </section>

      <section className="rounded-[6px] border border-steel/20 p-4">
        <h3 className="mb-1 font-heading text-base font-semibold text-ink">{t('admin.spuriousReports.reasonTitle')}</h3>
        <p className="whitespace-pre-wrap text-sm text-ink">{report.reasonNotes}</p>
      </section>

      {evidenceUrls.length > 0 ? (
        <section className="flex flex-wrap gap-2">
          {evidenceUrls.map((url) => (
            <img key={url} src={url} alt="" className="h-24 w-24 rounded-[6px] object-cover" />
          ))}
        </section>
      ) : null}

      {report.sellerResponse ? (
        <section className="rounded-[6px] border border-steel/20 bg-surface-muted p-4">
          <h3 className="mb-1 font-heading text-base font-semibold text-ink">{t('admin.spuriousReports.sellerResponseTitle')}</h3>
          <p className="text-sm text-ink">{report.sellerResponse.comment}</p>
        </section>
      ) : null}

      {report.status !== 'resolved' ? (
        <>
          {report.status === 'submitted' ? (
            <Button type="button" variant="outline" disabled={busy} onClick={handleStartReview}>
              {t('admin.spuriousReports.action.startReview')}
            </Button>
          ) : null}

          <section className="space-y-3 rounded-[6px] border border-steel/20 p-4">
            <h3 className="font-heading text-base font-semibold text-ink">{t('admin.spuriousReports.outcomeTitle')}</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {OUTCOMES.map((option) => (
                <label key={option} className="flex items-center gap-2 rounded-[6px] border border-steel/20 p-2 text-sm">
                  <input type="radio" name="outcome" checked={outcome === option} onChange={() => setOutcome(option)} />
                  {t(`admin.spuriousReports.outcome.${option}`)}
                </label>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="admin-notes">{t('admin.spuriousReports.notesLabel')}</Label>
              <Input id="admin-notes" value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} />
            </div>
            <Button type="button" variant="destructive" disabled={busy} onClick={handleResolve}>
              {t('admin.spuriousReports.action.resolve')}
            </Button>
          </section>
        </>
      ) : (
        <section className="rounded-[6px] border border-verify/30 bg-verify/5 p-4">
          <p className="text-sm text-verify">
            {t('admin.spuriousReports.resolvedWith', { outcome: report.outcome ? t(`admin.spuriousReports.outcome.${report.outcome}`) : '' })}
          </p>
        </section>
      )}
    </div>
  )
}
