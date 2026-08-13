import { qaAnswerSchema, sellerSchema, userSchema } from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { z } from 'zod'
import { requireUid } from '../orders/authz.js'
import { queueNotificationDirect } from '../orders/notify.js'
import { resolveUserLanguage } from '../seller/notifyLanguage.js'
import { stripUndefined } from '../util/stripUndefined.js'

const answerQuestionRequestSchema = z.object({
  questionId: z.string().min(1),
  body: z.string().min(1).max(2000),
})

const DELIVERED_STATUSES = ['delivered', 'completed'] as const

/**
 * Design brief item 6: Q&A "answerable by sellers and by buyers who
 * purchased" — eligibility is resolved server-side, never trusted from the
 * client. A seller claim qualifies only if they actually have an active
 * listing for this part; a buyer qualifies only if a delivered/completed
 * subOrder of theirs actually contains it (via the flat `purchasedPartIds`
 * denormalization on subOrderSchema — see createOrder.ts).
 */
export const answerQuestion = onCall({ enforceAppCheck: true, region: 'asia-south1' }, async (request): Promise<{ id: string }> => {
  const uid = requireUid(request)
  const sellerId = request.auth?.token.sellerId as string | undefined

  const parsed = answerQuestionRequestSchema.safeParse(request.data)
  if (!parsed.success) throw new HttpsError('invalid-argument', 'A valid answer is required')
  const input = parsed.data

  const db = getFirestore()
  const questionSnapshot = await db.collection('qaQuestions').doc(input.questionId).get()
  if (!questionSnapshot.exists) throw new HttpsError('not-found', 'question_not_found')
  const question = questionSnapshot.data() as { partId?: string; buyerId?: string; answerCount?: number }
  const partId = question.partId
  if (!partId) throw new HttpsError('failed-precondition', 'question_malformed')

  let answererRole: 'seller' | 'buyer' | undefined
  let answererDisplayName: string | undefined
  let answeringSellerId: string | undefined

  if (typeof sellerId === 'string' && sellerId.length > 0) {
    const listingSnapshot = await db
      .collection('listings')
      .where('sellerId', '==', sellerId)
      .where('partId', '==', partId)
      .limit(1)
      .get()
    if (!listingSnapshot.empty) {
      const sellerSnapshot = await db.collection('sellers').doc(sellerId).get()
      const seller = sellerSnapshot.exists ? sellerSchema.safeParse({ id: sellerSnapshot.id, ...sellerSnapshot.data() }) : undefined
      answererRole = 'seller'
      answererDisplayName = seller?.success ? seller.data.businessName : 'Seller'
      answeringSellerId = sellerId
    }
  }

  if (!answererRole) {
    const purchaseSnapshot = await db
      .collection('subOrders')
      .where('buyerId', '==', uid)
      .where('purchasedPartIds', 'array-contains', partId)
      .where('status', 'in', [...DELIVERED_STATUSES])
      .limit(1)
      .get()
    if (!purchaseSnapshot.empty) {
      const userSnapshot = await db.collection('users').doc(uid).get()
      const user = userSnapshot.exists ? userSchema.safeParse({ id: userSnapshot.id, ...userSnapshot.data() }) : undefined
      answererRole = 'buyer'
      answererDisplayName = user?.success ? user.data.displayName.split(' ')[0] : 'Verified buyer'
    }
  }

  if (!answererRole) throw new HttpsError('permission-denied', 'not_eligible_to_answer')

  const now = Date.now()
  const answerRef = questionSnapshot.ref.collection('answers').doc()
  const { id: _id, ...answerDoc } = qaAnswerSchema.parse({
    id: answerRef.id,
    questionId: input.questionId,
    partId,
    answererId: uid,
    answererRole,
    answererDisplayName: answererDisplayName ?? 'SnapSpare user',
    sellerId: answeringSellerId,
    body: input.body,
    createdAt: now,
  })
  await answerRef.set(stripUndefined(answerDoc))

  await questionSnapshot.ref.update({
    answerCount: (question.answerCount ?? 0) + 1,
    lastAnsweredAt: now,
  })

  if (question.buyerId && question.buyerId !== uid) {
    await queueNotificationDirect(db, {
      userId: question.buyerId,
      type: 'qa_question_answered',
      language: await resolveUserLanguage(db, question.buyerId),
      partId,
    })
  }

  return { id: answerRef.id }
})
