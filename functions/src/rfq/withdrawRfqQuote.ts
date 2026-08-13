import { rfqQuoteSchema, withdrawRfqQuoteRequestSchema } from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { requireSellerId } from '../orders/authz.js'
import { queueNotification, type NotificationLanguage } from '../orders/notify.js'

export const withdrawRfqQuote = onCall({ enforceAppCheck: true, region: 'asia-south1' }, async (request): Promise<{ quoteId: string }> => {
  const sellerId = requireSellerId(request)

  const parsed = withdrawRfqQuoteRequestSchema.safeParse(request.data)
  if (!parsed.success) throw new HttpsError('invalid-argument', 'A valid quoteId is required')
  const { quoteId } = parsed.data

  const db = getFirestore()
  const quoteRef = db.collection('rfqQuotes').doc(quoteId)

  await db.runTransaction(async (tx) => {
    const quoteSnapshot = await tx.get(quoteRef)
    const buyerId = quoteSnapshot.exists ? (quoteSnapshot.data()?.buyerId as string) : undefined
    const buyerSnapshot = buyerId ? await tx.get(db.collection('users').doc(buyerId)) : undefined

    if (!quoteSnapshot.exists) throw new HttpsError('not-found', 'quote_not_found')
    const quote = rfqQuoteSchema.parse({ id: quoteSnapshot.id, ...quoteSnapshot.data() })
    if (quote.sellerId !== sellerId) throw new HttpsError('permission-denied', 'not_your_quote')
    if (quote.status !== 'pending') throw new HttpsError('failed-precondition', 'quote_not_pending')

    const preferredLanguage = buyerSnapshot?.exists ? buyerSnapshot.data()?.preferredLanguage : undefined
    const buyerLanguage: NotificationLanguage = preferredLanguage === 'hi' ? 'hi' : 'en'

    tx.update(quoteRef, { status: 'withdrawn', updatedAt: Date.now() })
    queueNotification(tx, db, {
      userId: quote.buyerId,
      type: 'rfq_quote_withdrawn',
      language: buyerLanguage,
      rfqId: quote.rfqId,
    })
  })

  return { quoteId }
})
