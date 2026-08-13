import { rfqSchema, withdrawRfqRequestSchema } from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { queueNotification, type NotificationLanguage } from '../orders/notify.js'

/** Buyer withdraws their own open/quoted RFQ, cascading every pending quote on it to 'withdrawn' and notifying the quoting sellers. */
export const withdrawRfq = onCall({ enforceAppCheck: true, region: 'asia-south1' }, async (request): Promise<{ rfqId: string }> => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required')
  const buyerId = request.auth.uid

  const parsed = withdrawRfqRequestSchema.safeParse(request.data)
  if (!parsed.success) throw new HttpsError('invalid-argument', 'A valid rfqId is required')
  const { rfqId } = parsed.data

  const db = getFirestore()
  const rfqRef = db.collection('rfqs').doc(rfqId)

  await db.runTransaction(async (tx) => {
    // ---- reads ----
    const rfqSnapshot = await tx.get(rfqRef)
    const pendingQuotesSnapshot = await tx.get(
      db.collection('rfqQuotes').where('rfqId', '==', rfqId).where('status', '==', 'pending'),
    )
    const sellerOwnerSnapshots = await Promise.all(
      pendingQuotesSnapshot.docs.map((doc) =>
        tx.get(db.collection('sellers').doc(doc.data().sellerId as string)),
      ),
    )

    // ---- validate ----
    if (!rfqSnapshot.exists) throw new HttpsError('not-found', 'rfq_not_found')
    const rfq = rfqSchema.parse({ id: rfqSnapshot.id, ...rfqSnapshot.data() })
    if (rfq.buyerId !== buyerId) throw new HttpsError('permission-denied', 'not_your_rfq')
    if (rfq.status !== 'open' && rfq.status !== 'quoted') {
      throw new HttpsError('failed-precondition', 'rfq_not_withdrawable')
    }

    const ownerUserIdBySellerId = new Map<string, string>()
    sellerOwnerSnapshots.forEach((snapshot) => {
      if (snapshot.exists) ownerUserIdBySellerId.set(snapshot.id, snapshot.data()?.ownerUserId as string)
    })
    const ownerLanguageSnapshots = await Promise.all(
      Array.from(ownerUserIdBySellerId.values()).map((uid) => tx.get(db.collection('users').doc(uid))),
    )
    const languageByOwnerUid = new Map<string, NotificationLanguage>()
    ownerLanguageSnapshots.forEach((snapshot) => {
      const preferredLanguage = snapshot.exists ? snapshot.data()?.preferredLanguage : undefined
      languageByOwnerUid.set(snapshot.id, preferredLanguage === 'hi' ? 'hi' : 'en')
    })

    // ---- writes ----
    const now = Date.now()
    tx.update(rfqRef, { status: 'withdrawn', updatedAt: now })

    pendingQuotesSnapshot.docs.forEach((doc) => {
      tx.update(doc.ref, { status: 'withdrawn', updatedAt: now })
      const sellerId = doc.data().sellerId as string
      const ownerUserId = ownerUserIdBySellerId.get(sellerId)
      if (!ownerUserId) return
      queueNotification(tx, db, {
        userId: ownerUserId,
        type: 'rfq_withdrawn_by_buyer',
        language: languageByOwnerUid.get(ownerUserId) ?? 'en',
        rfqId,
      })
    })
  })

  return { rfqId }
})
