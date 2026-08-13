import type { SellerApplication } from '@snapspare/shared'
import { CheckCircle2, CircleDot, XCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const TRACK_STEPS = ['submitted', 'under_review', 'approved'] as const

interface ApplicationStatusTrackerProps {
  application: SellerApplication
  onResumeEditing: () => void
}

/** Draft -> submitted -> under_review -> (changes_requested loops back to editing) -> approved | rejected. */
export function ApplicationStatusTracker({ application, onResumeEditing }: ApplicationStatusTrackerProps) {
  const { t } = useTranslation()
  const { status } = application

  if (status === 'rejected') {
    return (
      <div className="space-y-3 rounded-[6px] border border-alert/30 bg-alert/5 p-4">
        <p className="inline-flex items-center gap-2 font-heading text-lg font-semibold text-ink">
          <XCircle className="h-5 w-5 text-alert" aria-hidden="true" />
          {t('sell.tracker.rejectedTitle')}
        </p>
        <p className="text-sm text-steel">{t('sell.tracker.rejectedDescription')}</p>
        {application.reviewNotes.length > 0 ? (
          <ul className="space-y-1 text-sm text-ink">
            {application.reviewNotes.map((note, i) => (
              <li key={i}>{note.message}</li>
            ))}
          </ul>
        ) : null}
      </div>
    )
  }

  if (status === 'changes_requested') {
    return (
      <div className="space-y-3 rounded-[6px] border border-signal/30 bg-signal/5 p-4">
        <p className="font-heading text-lg font-semibold text-ink">{t('sell.tracker.changesRequestedTitle')}</p>
        <p className="text-sm text-steel">{t('sell.tracker.changesRequestedDescription')}</p>
        <ul className="space-y-2">
          {application.reviewNotes.map((note, i) => (
            <li key={i} className="rounded-[6px] border border-steel/20 bg-surface p-2 text-sm">
              <span className="font-medium text-ink">{t(`sell.wizard.steps.${note.step === 'tax_identity' ? 'taxIdentity' : note.step}`)}: </span>
              <span className="text-steel">{note.message}</span>
            </li>
          ))}
        </ul>
        <Button variant="cta" onClick={onResumeEditing}>
          {t('sell.tracker.resumeEditing')}
        </Button>
      </div>
    )
  }

  const activeIndex = TRACK_STEPS.indexOf(status as (typeof TRACK_STEPS)[number])

  return (
    <div className="space-y-4 rounded-[6px] border border-steel/20 p-4">
      <p className="font-heading text-lg font-semibold text-ink">{t('sell.tracker.title')}</p>
      <ol className="space-y-3">
        {TRACK_STEPS.map((step, index) => {
          const isDone = index < activeIndex || status === 'approved'
          const isCurrent = index === activeIndex && status !== 'approved'
          return (
            <li key={step} className="flex items-start gap-3">
              {isDone ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-verify" aria-hidden="true" />
              ) : (
                <CircleDot className={cn('mt-0.5 h-5 w-5 shrink-0', isCurrent ? 'text-signal' : 'text-steel/40')} aria-hidden="true" />
              )}
              <div>
                <p className={cn('text-sm font-medium', isCurrent ? 'text-ink' : 'text-steel')}>{t(`sell.tracker.step.${step}`)}</p>
                {isCurrent ? <p className="text-xs text-steel">{t(`sell.tracker.stepDescription.${step}`)}</p> : null}
              </div>
            </li>
          )
        })}
      </ol>
      {status === 'approved' ? (
        <p className="text-sm font-medium text-verify">{t('sell.tracker.approvedDescription')}</p>
      ) : null}
    </div>
  )
}
