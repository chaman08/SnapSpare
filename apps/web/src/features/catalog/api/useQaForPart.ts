import type { QaAnswer, QaQuestion } from '@snapspare/shared'
import { qaAnswerConverter, qaQuestionConverter } from '@snapspare/shared'
import { useQuery } from '@tanstack/react-query'
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { clientConverter } from '@/lib/firestoreConverter'

export interface QaQuestionWithAnswers extends QaQuestion {
  answers: QaAnswer[]
}

/** Newest-first, part-level (a question applies regardless of which seller's listing the buyer eventually orders from — see qaQuestionSchema's doc comment). Each question's `answers` subcollection is fetched alongside it — question volume per part is small, so the extra round trips per question are cheap. */
export function useQaForPart(partId: string | undefined) {
  return useQuery({
    queryKey: ['qa-for-part', partId],
    queryFn: async (): Promise<QaQuestionWithAnswers[]> => {
      if (!partId) return []
      const snapshot = await getDocs(
        query(
          collection(db, 'qaQuestions').withConverter(clientConverter(qaQuestionConverter)),
          where('partId', '==', partId),
          orderBy('createdAt', 'desc'),
        ),
      )
      const questions = snapshot.docs.map((d) => d.data())

      return Promise.all(
        questions.map(async (question) => {
          const answersSnapshot = await getDocs(
            query(
              collection(db, 'qaQuestions', question.id, 'answers').withConverter(clientConverter(qaAnswerConverter)),
              orderBy('createdAt', 'asc'),
            ),
          )
          return { ...question, answers: answersSnapshot.docs.map((d) => d.data()) }
        }),
      )
    },
    enabled: Boolean(partId),
    staleTime: 30_000,
  })
}
