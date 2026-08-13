import { MAX_SPURIOUS_REPORT_EVIDENCE_IMAGES } from '@snapspare/shared'
import { Loader2, Upload, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/features/auth/api/AuthProvider'
import { mapSpuriousReportErrorToI18nKey, reportSpuriousPart, uploadSpuriousReportEvidence } from '@/features/trust/api/spuriousReportActions'

interface ReportSpuriousPartDialogProps {
  orderId?: string
  subOrderId?: string
  listingId: string
  partId: string
  sellerId: string
  onClose: () => void
}

/** "Report a suspicious part" (design brief item 4) — reachable from order and product pages. Structured reason + up to 6 evidence photos, kicks off the admin investigation workflow. */
export function ReportSpuriousPartDialog({ orderId, subOrderId, listingId, partId, sellerId, onClose }: ReportSpuriousPartDialogProps) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [reasonNotes, setReasonNotes] = useState('')
  const [evidenceImages, setEvidenceImages] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleFilesSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    if (files.length === 0 || !user) return
    setUploading(true)
    try {
      const remaining = Math.max(0, MAX_SPURIOUS_REPORT_EVIDENCE_IMAGES - evidenceImages.length)
      const uploaded: string[] = []
      for (const file of files.slice(0, remaining)) {
        uploaded.push(await uploadSpuriousReportEvidence(user.uid, file))
      }
      setEvidenceImages((prev) => [...prev, ...uploaded])
    } catch {
      toast.error(t('common.somethingWentWrong'))
    } finally {
      setUploading(false)
      event.target.value = ''
    }
  }

  async function handleSubmit() {
    if (!reasonNotes.trim()) return
    setSubmitting(true)
    try {
      await reportSpuriousPart({ orderId, subOrderId, listingId, partId, sellerId, reasonNotes: reasonNotes.trim(), evidenceImages })
      toast.success(t('trust.spuriousReport.success'))
      onClose()
    } catch (error) {
      toast.error(t(mapSpuriousReportErrorToI18nKey(error)))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('trust.spuriousReport.title')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="spurious-reason">{t('trust.spuriousReport.reasonLabel')}</Label>
            <textarea
              id="spurious-reason"
              rows={4}
              value={reasonNotes}
              onChange={(e) => setReasonNotes(e.target.value)}
              placeholder={t('trust.spuriousReport.reasonPlaceholder')}
              className="w-full rounded-[6px] border border-steel/30 bg-surface p-2 text-base text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-ink">{t('trust.spuriousReport.evidenceLabel', { max: MAX_SPURIOUS_REPORT_EVIDENCE_IMAGES })}</p>
            {evidenceImages.length > 0 ? (
              <ul className="flex flex-wrap gap-2">
                {evidenceImages.map((path) => (
                  <li key={path} className="flex items-center gap-1 rounded-[6px] border border-steel/20 bg-surface-muted px-2 py-1 text-xs text-steel">
                    <span className="max-w-[10rem] truncate font-mono">{path.split('/').pop()}</span>
                    <button type="button" onClick={() => setEvidenceImages((prev) => prev.filter((p) => p !== path))} aria-label={t('common.remove')}>
                      <X className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <input
              type="file"
              id="spurious-evidence-input"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              multiple
              className="sr-only"
              onChange={handleFilesSelected}
              aria-label={t('trust.spuriousReport.addEvidence')}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading || evidenceImages.length >= MAX_SPURIOUS_REPORT_EVIDENCE_IMAGES}
              onClick={() => document.getElementById('spurious-evidence-input')?.click()}
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Upload className="h-4 w-4" aria-hidden="true" />}
              {uploading ? t('common.loading') : t('trust.spuriousReport.addEvidence')}
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            {t('common.cancel')}
          </Button>
          <Button type="button" variant="destructive" onClick={handleSubmit} disabled={submitting || !reasonNotes.trim()}>
            {submitting ? t('common.loading') : t('trust.spuriousReport.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
