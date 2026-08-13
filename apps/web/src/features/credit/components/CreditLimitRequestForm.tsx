import { toPaise } from '@snapspare/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { requestCreditLimit } from '@/features/credit/api/creditActions'

/** Verified-garage-only ask for a Khata limit (design brief item 7). Submission goes to admin approval — see approveCreditLimit.ts. */
export function CreditLimitRequestForm() {
  const { t } = useTranslation()
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit() {
    const rupees = Number(amount)
    if (!Number.isFinite(rupees) || rupees <= 0) return
    setSubmitting(true)
    try {
      await requestCreditLimit({ requestedLimitPaise: toPaise(rupees), reason: reason || undefined })
      setSubmitted(true)
      toast.success(t('khata.requestSubmitted'))
    } catch {
      toast.error(t('khata.requestFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return <p className="rounded-[6px] border border-verify/30 bg-verify/5 p-4 text-sm text-verify">{t('khata.requestSubmitted')}</p>
  }

  return (
    <div className="space-y-3 rounded-[6px] border border-steel/20 bg-white p-4">
      <h3 className="font-heading text-base font-semibold text-ink">{t('khata.requestLimitTitle')}</h3>
      <div>
        <Label htmlFor="requested-limit">{t('khata.requestedLimit')}</Label>
        <Input id="requested-limit" type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="request-reason">{t('khata.reasonOptional')}</Label>
        <Input id="request-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
      <Button type="button" variant="cta" disabled={submitting || !amount} onClick={() => void handleSubmit()}>
        {submitting ? t('common.loading') : t('khata.submitRequest')}
      </Button>
    </div>
  )
}
