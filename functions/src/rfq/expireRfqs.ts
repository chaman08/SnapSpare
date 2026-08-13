import { rfqQuoteSchema, rfqSchema } from '@snapspare/shared'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { queueNotification, type NotificationLanguage } from '../orders/notify.js'

const BATCH_SIZE = 50

async function resolveLanguage(db: Firestore, userId: string): Promise<NotificationLanguage> {
  const snapshot = await db.collection('users').doc(userId).get()
  return (snapshot.exists ? snapshot.data()?.preferredLanguage : undefined) === 'hi' ? 'hi' : 'en'
}

/** Closes one RFQ past its response window or required-by date with no accepted quote, cascading every pending quote on it to 'expired' and notifying the quoting sellers plus the buyer. */
async function expireOneRfq(db: Firestore, rfqId: string): Promise<void> {
  const rfqRef = db.collection('rfqs').doc(rfqId)

  await db.runTransaction(async (tx) => {
    const rfqSnapshot = await tx.get(rfqRef)
    if (!rfqSnapshot.exists) return
    const rfq = rfqSchema.parse({ id: rfqSnapshot.id, ...rfqSnapshot.data() })
    if (rfq.status !== 'open' && rfq.status !== 'quoted') return

    const pendingQuotesSnapshot = await tx.get(
      db.collection('rfqQuotes').where('rfqId', '==', rfqId).where('status', '==', 'pending'),
    )
    const sellerRefs = pendingQuotesSnapshot.docs.map((doc) => db.collection('sellers').doc(doc.data().sellerId as string))
    const sellerSnapshots = await Promise.all(sellerRefs.map((ref) => tx.get(ref)))
    const ownerUidBySellerId = new Map<string, string>()
    sellerSnapshots.forEach((snapshot) => {
      if (snapshot.exists) ownerUidBySellerId.set(snapshot.id, snapshot.data()?.ownerUserId as string)
    })
    const ownerUserSnapshots = await Promise.all(
      Array.from(ownerUidBySellerId.values()).map((uid) => tx.get(db.collection('users').doc(uid))),
    )
    const languageByUid = new Map<string, NotificationLanguage>()
    ownerUserSnapshots.forEach((snapshot) => {
      languageByUid.set(snapshot.id, (snapshot.exists ? snapshot.data()?.preferredLanguage : undefined) === 'hi' ? 'hi' : 'en')
    })
    const buyerLanguage = await resolveLanguage(db, rfq.buyerId)

    const now = Date.now()
    tx.update(rfqRef, { status: 'expired', updatedAt: now })
    queueNotification(tx, db, { userId: rfq.buyerId, type: 'rfq_expired', language: buyerLanguage, rfqId })

    pendingQuotesSnapshot.docs.forEach((doc) => {
      tx.update(doc.ref, { status: 'expired', updatedAt: now })
      const sellerId = doc.data().sellerId as string
      const ownerUserId = ownerUidBySellerId.get(sellerId)
      if (!ownerUserId) return
      queueNotification(tx, db, {
        userId: ownerUserId,
        type: 'rfq_expired',
        language: languageByUid.get(ownerUserId) ?? 'en',
        rfqId,
      })
    })
  })
}

/** Expires one quote whose own `validUntil` has passed while its parent RFQ is still otherwise open/quoted (other quotes on it may still be live). */
async function expireOneQuote(db: Firestore, quoteId: string): Promise<void> {
  const quoteRef = db.collection('rfqQuotes').doc(quoteId)

  await db.runTransaction(async (tx) => {
    const quoteSnapshot = await tx.get(quoteRef)
    if (!quoteSnapshot.exists) return
    const quote = rfqQuoteSchema.parse({ id: quoteSnapshot.id, ...quoteSnapshot.data() })
    if (quote.status !== 'pending') return

    const buyerLanguage = await resolveLanguage(db, quote.buyerId)
    tx.update(quoteRef, { status: 'expired', updatedAt: Date.now() })
    queueNotification(tx, db, { userId: quote.buyerId, type: 'rfq_expired', language: buyerLanguage, rfqId: quote.rfqId })
  })
}

/** Requirement 6: expiry handled by a scheduled function. Runs every 6 hours — well inside the 48h response window routing.ts sets, so an RFQ is never left open meaningfully longer than its window/required-by date promises. */
export const expireRfqs = onSchedule({ region: 'asia-south1', schedule: 'every 6 hours' }, async () => {
  const db = getFirestore()
  const now = Date.now()

  const [byResponseDeadline, byRequiredByDate, byQuoteValidity] = await Promise.all([
    db.collection('rfqs').where('status', 'in', ['open', 'quoted']).where('responseDeadline', '<=', now).limit(BATCH_SIZE).get(),
    db.collection('rfqs').where('status', 'in', ['open', 'quoted']).where('requiredByDate', '<=', now).limit(BATCH_SIZE).get(),
    db.collection('rfqQuotes').where('status', '==', 'pending').where('validUntil', '<=', now).limit(BATCH_SIZE).get(),
  ])

  const rfqIds = new Set([...byResponseDeadline.docs.map((d) => d.id), ...byRequiredByDate.docs.map((d) => d.id)])
  await Promise.all(Array.from(rfqIds).map((rfqId) => expireOneRfq(db, rfqId)))
  await Promise.all(byQuoteValidity.docs.map((doc) => expireOneQuote(db, doc.id)))
})
