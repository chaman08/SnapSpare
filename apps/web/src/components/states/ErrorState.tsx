import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'

interface ErrorStateProps {
  onRetry: () => void
  message?: string
}

/** Standard error state for list screens: always paired with a retry action. */
export function ErrorState({ onRetry, message }: ErrorStateProps) {
  const { t } = useTranslation()

  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 px-6 py-16 text-center"
    >
      <p className="font-heading text-lg font-semibold text-alert">
        {message ?? t('common.somethingWentWrong')}
      </p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        {t('common.retry')}
      </Button>
    </div>
  )
}
