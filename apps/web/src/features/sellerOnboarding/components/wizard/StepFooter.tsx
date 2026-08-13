import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'

interface StepFooterProps {
  onBack?: () => void
  isSubmitting: boolean
  continueLabel?: string
  continueDisabled?: boolean
}

/** Shared Back/Continue footer for every wizard step — each step's own form submit handles the "Continue" click via the surrounding <form>'s onSubmit. */
export function StepFooter({ onBack, isSubmitting, continueLabel, continueDisabled }: StepFooterProps) {
  const { t } = useTranslation()
  return (
    <div className="flex gap-2 pt-2">
      {onBack ? (
        <Button type="button" variant="outline" onClick={onBack} disabled={isSubmitting}>
          {t('sell.wizard.back')}
        </Button>
      ) : null}
      <Button type="submit" variant="cta" className="flex-1" disabled={isSubmitting || continueDisabled}>
        {isSubmitting ? t('common.loading') : (continueLabel ?? t('sell.wizard.continue'))}
      </Button>
    </div>
  )
}
