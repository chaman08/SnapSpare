import type { WarrantyClaim, WarrantyClaimResolutionType } from '@snapspare/shared'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { decideWarrantyClaim, getWarrantyClaimEvidenceUrls } from '@/features/orders/api/warrantyClaimActions'

const RESOLUTION_TYPES: WarrantyClaimResolutionType[] = ['refund', 'replacement', 'repair_reimbursement']

interface WarrantyClaimPanelProps {
  claim: WarrantyClaim
}

/** Admin resolution of a brand-escalated warranty claim (design brief item 6) — the brand conversation happens offline (no brand-contact directory in this system, see the schema's header comment); this just records the outcome. */
export function WarrantyClaimPanel({ claim }: WarrantyClaimPanelProps) {
  const { t } = useTranslation()
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>([])
  const [resolutionType, setResolutionType] = useState<WarrantyClaimResolutionType>('refund')
  const [amountPaise, setAmountPaise] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (claim.evidenceImages.length === 0) return
    getWarrantyClaimEvidenceUrls(claim.id)
      .then((r) => setEvidenceUrls(r.urls))
      .catch(() => undefined)
  }, [claim.id, claim.evidenceImages.length])

  async function handleResolve() {
    if (note.trim().length === 0) return
    setBusy(true)
    try {
      await decideWarrantyClaim({
        claimId: claim.id,
        action: 'resolve',
        resolutionType,
        amountPaise: amountPaise ? Number(amountPaise) : undefined,
        note: note.trim(),
      })
      toast.success(t('admin.warrantyClaims.actionSuccess'))
    } catch {
      toast.error(t('admin.warrantyClaims.actionFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-3 rounded-[6px] border border-steel/20 p-4 sm:grid-cols-3">
        <div>
          <dt className="text-xs text-steel">{t('admin.warrantyClaims.sellerLabel')}</dt>
          <dd className="font-mono text-sm text-ink">{claim.sellerId}</dd>
        </div>
        <div>
          <dt className="text-xs text-steel">{t('admin.warrantyClaims.brandLabel')}</dt>
          <dd className="text-sm text-ink">{claim.brandName ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-steel">{t('admin.warrantyClaims.statusLabel')}</dt>
          <dd className="text-sm text-ink">{t(`admin.warrantyClaims.status.${claim.status}`)}</dd>
        </div>
      </section>

      <section className="rounded-[6px] border border-steel/20 p-4">
        <h3 className="mb-1 font-heading text-base font-semibold text-ink">{t('admin.warrantyClaims.reasonLabel')}</h3>
        <p className="text-sm text-ink">{t(`orders.warranty.reasons.${claim.reason}`)}</p>
        <p className="mt-2 whitespace-pre-wrap text-sm text-ink">{claim.description}</p>
      </section>

      {evidenceUrls.length > 0 ? (
        <section className="flex flex-wrap gap-2">
          {evidenceUrls.map((url) => (
            <img key={url} src={url} alt="" className="h-24 w-24 rounded-[6px] object-cover" />
          ))}
        </section>
      ) : null}

      {claim.status !== 'resolved' ? (
        <section className="space-y-3 rounded-[6px] border border-steel/20 p-4">
          <h3 className="font-heading text-base font-semibold text-ink">{t('admin.warrantyClaims.resolutionTypeLabel')}</h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {RESOLUTION_TYPES.map((option) => (
              <label key={option} className="flex items-center gap-2 rounded-[6px] border border-steel/20 p-2 text-sm">
                <input type="radio" name="resolutionType" checked={resolutionType === option} onChange={() => setResolutionType(option)} />
                {t(`admin.warrantyClaims.resolutionType.${option}`)}
              </label>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="claim-amount">{t('admin.warrantyClaims.amountLabel')}</Label>
            <Input id="claim-amount" type="number" min={0} value={amountPaise} onChange={(e) => setAmountPaise(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="claim-note">{t('admin.warrantyClaims.noteLabel')}</Label>
            <Input id="claim-note" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <Button type="button" variant="cta" disabled={busy || note.trim().length === 0} onClick={handleResolve}>
            {t('admin.warrantyClaims.resolve')}
          </Button>
        </section>
      ) : (
        <section className="rounded-[6px] border border-verify/30 bg-verify/5 p-4">
          <p className="text-sm text-verify">{claim.resolution?.note}</p>
        </section>
      )}
    </div>
  )
}
