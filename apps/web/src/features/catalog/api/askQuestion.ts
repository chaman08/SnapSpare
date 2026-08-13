import { qaQuestionSchema } from '@snapspare/shared'
import { addDoc, collection } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export interface AskQuestionInput {
  partId: string
  buyerId: string
  buyerDisplayName: string
  question: string
}

/** firestore.rules' qaQuestions `create` rule requires the write to come from `buyerId` itself — true here by construction. Answers (Phase 17) live in a subcollection written only by answerQuestion.ts, never here. */
export async function askQuestion(input: AskQuestionInput): Promise<void> {
  const payload = qaQuestionSchema.omit({ id: true, answerCount: true, lastAnsweredAt: true }).parse({
    partId: input.partId,
    buyerId: input.buyerId,
    buyerDisplayName: input.buyerDisplayName,
    question: input.question,
    createdAt: Date.now(),
  })
  await addDoc(collection(db, 'qaQuestions'), payload)
}
