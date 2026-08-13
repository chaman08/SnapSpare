import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { createTestEnv } from './testEnv.js'

const BUYER_UID = 'buyer-1'
const OTHER_BUYER_UID = 'buyer-2'
const SELLER_UID = 'seller-1-owner'
const SELLER_ID = 'seller-1'

const now = Date.now()

let testEnv: RulesTestEnvironment

beforeAll(async () => {
  testEnv = await createTestEnv()
})

afterAll(async () => {
  await testEnv.cleanup()
})

beforeEach(async () => {
  await testEnv.clearFirestore()
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore()

    await db.collection('qaQuestions').doc('question-1').set({
      partId: 'part-1',
      buyerId: BUYER_UID,
      buyerDisplayName: 'Priya',
      question: 'Does this fit a 2019 model?',
      answerCount: 1,
      lastAnsweredAt: now,
      createdAt: now,
    })

    await db
      .collection('qaQuestions')
      .doc('question-1')
      .collection('answers')
      .doc('answer-1')
      .set({
        questionId: 'question-1',
        partId: 'part-1',
        answererId: SELLER_UID,
        answererRole: 'seller',
        answererDisplayName: 'Acme Auto Parts',
        sellerId: SELLER_ID,
        body: 'Yes, this fits 2018-2020 models.',
        createdAt: now,
      })
  })
})

describe('qaQuestions', () => {
  it('lets anyone (even signed out) read a question', async () => {
    const db = testEnv.unauthenticatedContext().firestore()
    await assertSucceeds(db.collection('qaQuestions').doc('question-1').get())
  })

  it('lets a signed-in buyer create their own question', async () => {
    const db = testEnv.authenticatedContext(BUYER_UID).firestore()
    await assertSucceeds(
      db.collection('qaQuestions').doc('question-new').set({
        partId: 'part-1',
        buyerId: BUYER_UID,
        buyerDisplayName: 'Priya',
        question: 'Is this OEM or aftermarket?',
        answerCount: 0,
        createdAt: now,
      }),
    )
  })

  it("denies creating a question under someone else's buyerId", async () => {
    const db = testEnv.authenticatedContext(BUYER_UID).firestore()
    await assertFails(
      db.collection('qaQuestions').doc('question-spoofed').set({
        partId: 'part-1',
        buyerId: OTHER_BUYER_UID,
        buyerDisplayName: 'Priya',
        question: 'Is this OEM or aftermarket?',
        answerCount: 0,
        createdAt: now,
      }),
    )
  })

  it('denies any direct client update — answering must go through answerQuestion.ts', async () => {
    const db = testEnv.authenticatedContext(SELLER_UID, { role: 'seller', sellerId: SELLER_ID }).firestore()
    await assertFails(db.collection('qaQuestions').doc('question-1').update({ answerCount: 2 }))
  })

  it('denies a buyer deleting a question — admin only', async () => {
    const db = testEnv.authenticatedContext(BUYER_UID).firestore()
    await assertFails(db.collection('qaQuestions').doc('question-1').delete())
  })
})

describe('qaQuestions/{questionId}/answers — public read, Cloud-Function-only write', () => {
  it('lets anyone (even signed out) read an answer', async () => {
    const db = testEnv.unauthenticatedContext().firestore()
    await assertSucceeds(db.collection('qaQuestions').doc('question-1').collection('answers').doc('answer-1').get())
  })

  it('denies a direct client write to an answer, even by a genuine seller (must go through answerQuestion.ts)', async () => {
    const db = testEnv.authenticatedContext(SELLER_UID, { role: 'seller', sellerId: SELLER_ID }).firestore()
    await assertFails(
      db.collection('qaQuestions').doc('question-1').collection('answers').doc('answer-new').set({
        questionId: 'question-1',
        partId: 'part-1',
        answererId: SELLER_UID,
        answererRole: 'seller',
        answererDisplayName: 'Acme Auto Parts',
        sellerId: SELLER_ID,
        body: 'Another answer',
        createdAt: now,
      }),
    )
  })

  it('denies a buyer writing an answer directly', async () => {
    const db = testEnv.authenticatedContext(BUYER_UID).firestore()
    await assertFails(
      db.collection('qaQuestions').doc('question-1').collection('answers').doc('answer-buyer').set({
        questionId: 'question-1',
        partId: 'part-1',
        answererId: BUYER_UID,
        answererRole: 'buyer',
        answererDisplayName: 'Priya',
        body: 'I bought this and it fit fine',
        createdAt: now,
      }),
    )
  })
})
