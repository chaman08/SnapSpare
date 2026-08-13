import { returnSchema, sellerSchema } from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import { onDocumentWritten } from 'firebase-functions/v2/firestore'
import { type NotificationLanguage, queueNotificationDirect } from './notify.js'

async function languageFor(db: ReturnType<typeof getFirestore>, userId: string): Promise<NotificationLanguage> {
  const snapshot = await db.collection('users').doc(userId).get()
  return snapshot.exists && snapshot.data()?.preferredLanguage === 'hi' ? 'hi' : 'en'
}

/**
 * Notifies whoever needs to know about a return's status changing. Reacts
 * to *any* write to a `returns/{returnId}` doc, regardless of whether it
 * came from the buyer's direct client create (firestore.rules allows
 * `status: 'requested'` creates directly — see requestReturn.ts's doc
 * comment for why a Cloud Function front-door is offered too), the seller's
 * direct client approve/reject update (also rules-permitted), or
 * refundReturn's Admin SDK write. One place, so every path that can change
 * a return's status gets the same notification coverage without each of
 * them having to remember to call queueNotification themselves.
 */
export const onReturnStatusChange = onDocumentWritten(
  { document: 'returns/{returnId}', region: 'asia-south1' },
  async (event) => {
    const before = event.data?.before.exists ? event.data.before.data() : undefined
    const after = event.data?.after.exists ? event.data.after.data() : undefined
    if (!after || before?.status === after.status) return

    const parsed = returnSchema.safeParse({ id: event.params.returnId, ...after })
    if (!parsed.success) {
      logger.error('onReturnStatusChange: return doc failed schema validation', {
        returnId: event.params.returnId,
        issues: parsed.error.issues,
      })
      return
    }
    const ret = parsed.data
    const db = getFirestore()

    if (ret.status === 'requested') {
      const sellerSnapshot = await db.collection('sellers').doc(ret.sellerId).get()
      if (!sellerSnapshot.exists) return
      const seller = sellerSchema.safeParse({ id: sellerSnapshot.id, ...sellerSnapshot.data() })
      if (!seller.success) return
      await queueNotificationDirect(db, {
        userId: seller.data.ownerUserId,
        type: 'return_requested',
        language: await languageFor(db, seller.data.ownerUserId),
        orderId: ret.orderId,
        subOrderId: ret.subOrderId,
        returnId: ret.id,
      })
      return
    }

    if (ret.status === 'approved' || ret.status === 'rejected') {
      await queueNotificationDirect(db, {
        userId: ret.buyerId,
        type: ret.status === 'approved' ? 'return_approved' : 'return_rejected',
        language: await languageFor(db, ret.buyerId),
        orderId: ret.orderId,
        subOrderId: ret.subOrderId,
        returnId: ret.id,
      })

      if (ret.status === 'approved') {
        // Reverse pickup is booked — the ball is now in the seller's court for QC.
        const sellerSnapshot = await db.collection('sellers').doc(ret.sellerId).get()
        if (sellerSnapshot.exists) {
          const seller = sellerSchema.safeParse({ id: sellerSnapshot.id, ...sellerSnapshot.data() })
          if (seller.success) {
            await queueNotificationDirect(db, {
              userId: seller.data.ownerUserId,
              type: 'return_picked_up_qc_pending',
              language: await languageFor(db, seller.data.ownerUserId),
              orderId: ret.orderId,
              subOrderId: ret.subOrderId,
              returnId: ret.id,
            })
          }
        }
      }
      return
    }

    if (ret.status === 'qc_disputed') {
      await queueNotificationDirect(db, {
        userId: ret.buyerId,
        type: 'return_qc_disputed',
        language: await languageFor(db, ret.buyerId),
        orderId: ret.orderId,
        subOrderId: ret.subOrderId,
        returnId: ret.id,
      })
    }

    // 'qc_passed' is a transient intermediate status resolveReturnQcPass.ts
    // immediately advances past — no standalone notification. 'refunded'/
    // 'replaced' are written by resolveReturnQcPass.ts (or refundReturn.ts),
    // which queue their own notification in the same transaction as the
    // stock restore and subOrder status update — not repeated here.
  },
)
