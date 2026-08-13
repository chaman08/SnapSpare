import {
  findContactInfo,
  rfqMessageSchema,
  rfqQuoteSchema,
  sendRfqMessageRequestSchema,
  type SendRfqMessageResult,
} from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { queueNotificationDirect, type NotificationLanguage } from '../orders/notify.js'
import { stripUndefined } from '../util/stripUndefined.js'

/**
 * Requirement 5: one private thread per (rfq, seller) quote. Moderates the
 * body for phone numbers/emails server-side *before* it's ever persisted —
 * per the design brief, this is stated honestly to the sender (a specific
 * `contact_info_blocked` error the client renders as an inline warning),
 * never silently stripped.
 */
export const sendRfqMessage = onCall({ enforceAppCheck: true, region: 'asia-south1' }, async (request): Promise<SendRfqMessageResult> => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required')
  const senderId = request.auth.uid
  const sellerId = request.auth.token.sellerId as string | undefined

  const parsed = sendRfqMessageRequestSchema.safeParse(request.data)
  if (!parsed.success) throw new HttpsError('invalid-argument', 'A valid message is required')
  const input = parsed.data

  const contactInfoKind = findContactInfo(input.body)
  if (contactInfoKind) {
    throw new HttpsError('invalid-argument', 'contact_info_blocked', { kind: contactInfoKind })
  }

  const db = getFirestore()
  const quoteRef = db.collection('rfqQuotes').doc(input.quoteId)
  const quoteSnapshot = await quoteRef.get()
  if (!quoteSnapshot.exists) throw new HttpsError('not-found', 'quote_not_found')
  const quote = rfqQuoteSchema.parse({ id: quoteSnapshot.id, ...quoteSnapshot.data() })

  let senderRole: 'buyer' | 'seller'
  let recipientUserId: string
  if (quote.buyerId === senderId) {
    senderRole = 'buyer'
    const sellerSnapshot = await db.collection('sellers').doc(quote.sellerId).get()
    if (!sellerSnapshot.exists) throw new HttpsError('failed-precondition', 'seller_unavailable')
    recipientUserId = sellerSnapshot.data()?.ownerUserId as string
  } else if (sellerId === quote.sellerId) {
    senderRole = 'seller'
    recipientUserId = quote.buyerId
  } else {
    throw new HttpsError('permission-denied', 'not_a_participant')
  }

  const now = Date.now()
  const messageRef = quoteRef.collection('messages').doc()
  const { id: _id, ...messageDoc } = rfqMessageSchema.parse({
    id: messageRef.id,
    rfqId: quote.rfqId,
    quoteId: quote.id,
    buyerId: quote.buyerId,
    sellerId: quote.sellerId,
    senderRole,
    senderId,
    body: input.body,
    attachments: input.attachments,
    createdAt: now,
  })
  await messageRef.set(stripUndefined(messageDoc))

  const recipientSnapshot = await db.collection('users').doc(recipientUserId).get()
  const preferredLanguage = recipientSnapshot.exists ? recipientSnapshot.data()?.preferredLanguage : undefined
  const language: NotificationLanguage = preferredLanguage === 'hi' ? 'hi' : 'en'
  await queueNotificationDirect(db, {
    userId: recipientUserId,
    type: 'rfq_message_received',
    language,
    rfqId: quote.rfqId,
  })

  return { messageId: messageRef.id }
})
