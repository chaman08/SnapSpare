import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'
import { EmptyState } from '@/components/states/EmptyState'
import { ErrorState } from '@/components/states/ErrorState'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/features/auth/api/AuthProvider'
import { answerQuestion, mapQaErrorToI18nKey } from '@/features/catalog/api/answerQuestion'
import { askQuestion } from '@/features/catalog/api/askQuestion'
import { useQaForPart, type QaQuestionWithAnswers } from '@/features/catalog/api/useQaForPart'

interface QaTabProps {
  partId: string
}

const askFormSchema = z.object({
  question: z.string().min(3).max(500),
})
type AskFormValues = z.infer<typeof askFormSchema>

const answerFormSchema = z.object({
  body: z.string().min(1).max(2000),
})
type AnswerFormValues = z.infer<typeof answerFormSchema>

function AnswerForm({ questionId, onAnswered }: { questionId: string; onAnswered: () => void }) {
  const { t } = useTranslation()
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<AnswerFormValues>({ resolver: zodResolver(answerFormSchema), defaultValues: { body: '' } })

  const onSubmit = handleSubmit(async (values) => {
    try {
      await answerQuestion({ questionId, body: values.body })
      reset({ body: '' })
      toast.success(t('product.detail.qa.answerSuccess'))
      onAnswered()
    } catch (error) {
      toast.error(t(mapQaErrorToI18nKey(error)))
    }
  })

  return (
    <form onSubmit={onSubmit} className="mt-2 space-y-1.5">
      <textarea
        rows={2}
        placeholder={t('product.detail.qa.answerPlaceholder')}
        className="w-full rounded-[6px] border border-steel/30 bg-surface p-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
        {...register('body')}
      />
      <Button type="submit" variant="outline" size="sm" disabled={isSubmitting}>
        {isSubmitting ? t('common.loading') : t('product.detail.qa.answerSubmit')}
      </Button>
    </form>
  )
}

function QuestionRow({ qa, onChanged }: { qa: QaQuestionWithAnswers; onChanged: () => void }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [answering, setAnswering] = useState(false)

  return (
    <li className="border-b border-steel/15 pb-4 last:border-0">
      <p className="text-sm font-medium text-ink">Q: {qa.question}</p>
      <p className="mt-0.5 text-xs text-steel">{qa.buyerDisplayName}</p>

      {qa.answers.length > 0 ? (
        <ul className="mt-2 space-y-2">
          {qa.answers.map((answer) => (
            <li key={answer.id} className="rounded-[6px] bg-surface-muted p-2.5">
              <p className="text-sm text-ink">A: {answer.body}</p>
              <p className="mt-0.5 text-xs text-steel">
                {answer.answererDisplayName}
                {answer.answererRole === 'seller' ? ` · ${t('product.detail.qa.sellerAnswerBadge')}` : ''}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-steel">{t('product.detail.qa.unanswered')}</p>
      )}

      {user ? (
        answering ? (
          <AnswerForm questionId={qa.id} onAnswered={() => { setAnswering(false); onChanged() }} />
        ) : (
          <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => setAnswering(true)}>
            {t('product.detail.qa.answerAction')}
          </Button>
        )
      ) : null}
    </li>
  )
}

export function QaTab({ partId }: QaTabProps) {
  const { t } = useTranslation()
  const { user, profile } = useAuth()
  const qaQuery = useQaForPart(partId)
  const [submitted, setSubmitted] = useState(false)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AskFormValues>({ resolver: zodResolver(askFormSchema), defaultValues: { question: '' } })

  const onSubmit = handleSubmit(async (values) => {
    if (!user) return
    await askQuestion({
      partId,
      buyerId: user.uid,
      buyerDisplayName: profile?.displayName?.split(' ')[0] || t('product.detail.qa.anonymousBuyer'),
      question: values.question,
    })
    reset({ question: '' })
    setSubmitted(true)
    toast.success(t('product.detail.qa.askSuccess'))
    await qaQuery.refetch()
  })

  const questions = qaQuery.data ?? []

  return (
    <div className="space-y-6">
      <div className="rounded-[6px] border border-steel/20 bg-surface-muted p-4">
        <p className="mb-2 text-sm font-medium text-ink">{t('product.detail.qa.askTitle')}</p>
        {!user ? (
          <div className="space-y-2">
            <p className="text-sm text-steel">{t('product.detail.qa.signInPrompt')}</p>
            <Button asChild variant="outline" size="sm">
              <Link to="/login">{t('auth.account.signIn')}</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-2" noValidate>
            <Label htmlFor="qa-question" className="sr-only">
              {t('product.detail.qa.askTitle')}
            </Label>
            <textarea
              id="qa-question"
              rows={2}
              className="flex w-full rounded-[6px] border border-steel/30 bg-surface px-3 py-2 text-base text-ink placeholder:text-steel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
              placeholder={t('product.detail.qa.questionPlaceholder')}
              {...register('question')}
            />
            {errors.question ? (
              <p role="alert" className="text-sm text-alert">
                {t('product.detail.qa.questionRequired')}
              </p>
            ) : null}
            <Button type="submit" variant="cta" size="sm" disabled={isSubmitting}>
              {isSubmitting ? t('common.loading') : t('product.detail.qa.submit')}
            </Button>
            {submitted ? <p aria-live="polite" className="text-xs text-verify">{t('product.detail.qa.askSuccess')}</p> : null}
          </form>
        )}
      </div>

      {qaQuery.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : qaQuery.isError ? (
        <ErrorState onRetry={() => qaQuery.refetch()} />
      ) : questions.length === 0 ? (
        <EmptyState title={t('product.detail.qa.emptyTitle')} description={t('product.detail.qa.emptyDescription')} />
      ) : (
        <ul className="space-y-4">
          {questions.map((qa) => (
            <QuestionRow key={qa.id} qa={qa} onChanged={() => qaQuery.refetch()} />
          ))}
        </ul>
      )}
    </div>
  )
}
