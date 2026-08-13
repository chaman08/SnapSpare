import { httpsCallable } from 'firebase/functions'
import { functions } from '@/lib/firebase'

interface AnswerQuestionRequest {
  questionId: string
  body: string
}

const answerQuestionCallable = httpsCallable<AnswerQuestionRequest, { id: string }>(functions, 'answerQuestion')

export const answerQuestion = (request: AnswerQuestionRequest) => answerQuestionCallable(request).then((r) => r.data)

/** Maps an answerQuestion failure to an i18n key under `product.detail.qa.errors.*`. */
export function mapQaErrorToI18nKey(error: unknown): string {
  const message = (error as { message?: string } | null)?.message ?? ''
  switch (message) {
    case 'not_eligible_to_answer':
      return 'product.detail.qa.errors.notEligible'
    case 'question_not_found':
      return 'product.detail.qa.errors.notFound'
    default:
      return 'product.detail.qa.errors.generic'
  }
}
