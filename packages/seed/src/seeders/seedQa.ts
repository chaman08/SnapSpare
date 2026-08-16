import type { CatalogPart } from '@snapspare/shared'
import { qaAnswerSchema, qaQuestionSchema } from '@snapspare/shared'
import { BUYER_BLUEPRINTS } from '../data/buyers.js'
import { SELLER_BLUEPRINTS } from '../data/sellers.js'
import { db } from '../lib/firebaseAdmin.js'
import { pick, pickMany, randomInt, weightedBool } from '../lib/random.js'

const QUESTION_COUNT = 40
const DAY_MS = 86_400_000

const QUESTION_TEMPLATES = [
  'Will this fit a 2018 model or only newer years?',
  'Is this the genuine OEM part or aftermarket?',
  'Does this come with the mounting bolts included?',
  'What is the warranty period on this part?',
  'Can I get this in bulk for my workshop with a better rate?',
  'Is COD available for this item?',
  'How long does delivery usually take to a smaller town?',
  'Is this compatible with both petrol and diesel variants?',
]

const SELLER_ANSWER_TEMPLATES = [
  'Yes, this fits the model range listed in the fitment checker above.',
  'This is a genuine part sourced directly from the manufacturer.',
  'Mounting hardware is included in the box.',
  'We offer a 6-month replacement warranty on this part.',
  'Yes, reach out to us directly for bulk pricing on workshop orders.',
]

const BUYER_ANSWER_TEMPLATES = [
  'I bought this last month, fit my car perfectly.',
  'Worked fine for me, no issues so far after a few weeks of use.',
  'Installed it myself, took about 20 minutes.',
]

export async function seedQa(rng: () => number, parts: CatalogPart[]): Promise<void> {
  const now = Date.now()
  const chosenParts = pickMany(rng, parts, QUESTION_COUNT)
  let questionCount = 0
  let answerCount = 0

  for (const [index, part] of chosenParts.entries()) {
    const buyer = pick(rng, BUYER_BLUEPRINTS)
    const questionId = `qa-${index + 1}`
    const createdAt = now - randomInt(rng, 1, 120) * DAY_MS

    const hasAnswer = weightedBool(rng, 0.65)
    let lastAnsweredAt: number | undefined

    if (hasAnswer) {
      const matchingSeller = SELLER_BLUEPRINTS.find((seller) => seller.categorySlugs.includes(part.categorySlug))
      const answerFromSeller = matchingSeller && weightedBool(rng, 0.75)
      const answeredAt = createdAt + randomInt(rng, 1, 3) * DAY_MS
      lastAnsweredAt = answeredAt

      answerCount += 1
      const answerId = `${questionId}-a1`
      if (answerFromSeller && matchingSeller) {
        const answer = qaAnswerSchema.parse({
          id: answerId,
          questionId,
          partId: part.id,
          answererId: matchingSeller.ownerUserId,
          answererRole: 'seller',
          answererDisplayName: matchingSeller.businessName,
          sellerId: matchingSeller.id,
          body: pick(rng, SELLER_ANSWER_TEMPLATES),
          createdAt: answeredAt,
        })
        await db
          .collection('qaQuestions')
          .doc(questionId)
          .collection('answers')
          .doc(answerId)
          .set((({ id: _id, ...rest }) => rest)(answer))
      } else {
        const peerBuyer = pick(
          rng,
          BUYER_BLUEPRINTS.filter((candidate) => candidate.id !== buyer.id),
        )
        const answer = qaAnswerSchema.parse({
          id: answerId,
          questionId,
          partId: part.id,
          answererId: peerBuyer.id,
          answererRole: 'buyer',
          answererDisplayName: peerBuyer.displayName.split(' ')[0] as string,
          body: pick(rng, BUYER_ANSWER_TEMPLATES),
          createdAt: answeredAt,
        })
        await db
          .collection('qaQuestions')
          .doc(questionId)
          .collection('answers')
          .doc(answerId)
          .set((({ id: _id, ...rest }) => rest)(answer))
      }
    }

    const question = qaQuestionSchema.parse({
      id: questionId,
      partId: part.id,
      buyerId: buyer.id,
      buyerDisplayName: buyer.displayName.split(' ')[0] as string,
      question: pick(rng, QUESTION_TEMPLATES),
      answerCount: hasAnswer ? 1 : 0,
      lastAnsweredAt,
      createdAt,
    })
    const { id: _id, ...questionDoc } = question
    await db.collection('qaQuestions').doc(questionId).set(questionDoc)
    questionCount += 1
  }

  console.log(`  qaQuestions: ${questionCount}, qaAnswers: ${answerCount}`)
}
