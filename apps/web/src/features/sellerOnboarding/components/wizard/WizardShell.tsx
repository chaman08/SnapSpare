import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

const STEP_KEYS = ['business', 'taxIdentity', 'addresses', 'bank', 'documents', 'agreement'] as const

interface WizardShellProps {
  currentStep: number
  onStepClick?: (step: number) => void
  children: ReactNode
}

/** Step-progress header for the 6-step onboarding wizard — a stepped bar in the same visual language as the design system's quantity-slab ladder (filled up to the current step, next step outlined in --signal). */
export function WizardShell({ currentStep, onStepClick, children }: WizardShellProps) {
  const { t } = useTranslation()

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
      <ol className="flex gap-1" aria-label={t('sell.wizard.progressLabel')}>
        {STEP_KEYS.map((key, index) => {
          const step = index + 1
          const isDone = step < currentStep
          const isCurrent = step === currentStep
          return (
            <li key={key} className="flex-1">
              <button
                type="button"
                disabled={!onStepClick || step > currentStep}
                onClick={() => onStepClick?.(step)}
                aria-current={isCurrent ? 'step' : undefined}
                className={cn(
                  'h-1.5 w-full rounded-full transition-colors',
                  isDone ? 'bg-verify' : isCurrent ? 'bg-signal' : 'bg-steel/20',
                )}
              />
              <span className="sr-only">{t(`sell.wizard.steps.${key}`)}</span>
            </li>
          )
        })}
      </ol>
      <p className="text-sm font-medium text-steel">
        {t('sell.wizard.stepIndicator', { current: currentStep, total: STEP_KEYS.length })}
        {' · '}
        {t(`sell.wizard.steps.${STEP_KEYS[currentStep - 1]}`)}
      </p>
      {children}
    </div>
  )
}
