import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { submitSellerApplication } from '@/features/sellerOnboarding/api/sellerApplication'
import { StepFooter } from '@/features/sellerOnboarding/components/wizard/StepFooter'

interface StepAgreementProps {
  onSubmitted: () => void
  onBack: () => void
}

export function StepAgreement({ onSubmitted, onBack }: StepAgreementProps) {
  const { t } = useTranslation()
  const [accepted, setAccepted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!accepted) return
    setIsSubmitting(true)
    setError(null)
    try {
      await submitSellerApplication()
      onSubmitted()
    } catch {
      setError(t('sell.wizard.agreement.submitError'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="max-h-64 overflow-y-auto rounded-[6px] border border-steel/20 bg-surface-muted p-3 text-sm text-steel">
        <p>{t('sell.wizard.agreement.summaryIntro')}</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>{t('sell.wizard.agreement.point1')}</li>
          <li>{t('sell.wizard.agreement.point2')}</li>
          <li>{t('sell.wizard.agreement.point3')}</li>
          <li>{t('sell.wizard.agreement.point4')}</li>
        </ul>
      </div>

      <label className="flex items-start gap-2 text-sm text-ink">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 accent-signal"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
        />
        {t('sell.wizard.agreement.acceptLabel')}
      </label>

      {error ? (
        <p role="alert" className="text-sm text-alert">
          {error}
        </p>
      ) : null}

      <StepFooter
        onBack={onBack}
        isSubmitting={isSubmitting}
        continueLabel={t('sell.wizard.agreement.submit')}
        continueDisabled={!accepted}
      />
      {!accepted ? <p className="text-xs text-steel">{t('sell.wizard.agreement.acceptRequired')}</p> : null}
    </form>
  )
}
