import { z } from 'zod'
import { makeFirestoreConverter } from '../firestore/converter'
import { partIdSchema, qaAnswerIdSchema, qaQuestionIdSchema, sellerIdSchema, userIdSchema } from '../ids'
import { epochMsSchema } from './common'

/**
 * Part-level (not listing-level) Q&A — a question applies to the master
 * catalog part regardless of which seller's listing the buyer eventually
 * orders from, so it's asked once and answerable by any seller who stocks
 * it, or any buyer who purchased it (see functions/src/qa/answerQuestion.ts
 * — eligibility is checked server-side, never trusted from the client).
 * `buyerDisplayName` is denormalised at ask-time (first name only, see
 * askQuestion.ts) purely for display — questions are public, so the full
 * buyer profile is never exposed. Answers live in the `answers` subcollection
 * (a question can have more than one answerer) — `answerCount`/
 * `lastAnsweredAt` here are denormalized purely for list display/sorting.
 */
export const qaQuestionSchema = z.object({
  id: qaQuestionIdSchema,
  partId: partIdSchema,
  buyerId: userIdSchema,
  buyerDisplayName: z.string().min(1),
  question: z.string().min(3).max(500),
  answerCount: z.number().int().nonnegative().default(0),
  lastAnsweredAt: epochMsSchema.optional(),
  createdAt: epochMsSchema,
})
export type QaQuestion = z.infer<typeof qaQuestionSchema>

export const qaQuestionConverter = makeFirestoreConverter(qaQuestionSchema)

export const qaAnswererRoleSchema = z.enum(['seller', 'buyer'])
export type QaAnswererRole = z.infer<typeof qaAnswererRoleSchema>

/** `qaQuestions/{questionId}/answers/{answerId}` — written only by answerQuestion.ts (Admin SDK), never a direct client write; see firestore.rules. */
export const qaAnswerSchema = z.object({
  id: qaAnswerIdSchema,
  questionId: qaQuestionIdSchema,
  partId: partIdSchema,
  answererId: userIdSchema,
  answererRole: qaAnswererRoleSchema,
  answererDisplayName: z.string().min(1),
  /** Set only when answererRole === 'seller' — the seller whose listing qualified them to answer. */
  sellerId: sellerIdSchema.optional(),
  body: z.string().min(1).max(2000),
  createdAt: epochMsSchema,
})
export type QaAnswer = z.infer<typeof qaAnswerSchema>

export const qaAnswerConverter = makeFirestoreConverter(qaAnswerSchema)
