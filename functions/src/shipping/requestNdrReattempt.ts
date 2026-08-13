import { type RequestNdrReattemptResult, requestNdrReattemptRequestSchema } from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { loadSubOrderContext } from '../orders/loadContext.js'
import { queueNotification } from '../orders/notify.js'
import { appendTimelineEntry } from '../orders/timeline.js'

/**
 * Buyer confirms their delivery details after a failed attempt, asking the
 * seller to arrange a reattempt (design brief item 7's "reattempt
 * requests, buyer contact prompt"). Records the confirmation and notifies
 * the seller; actually telling the courier to reattempt via a live
 * Shiprocket NDR-action call isn't wired up yet — that's not one of the
 * six required provider-adapter methods, and needs NDR-action API access
 * this environment doesn't have. Noted here the same way this codebase
 * already notes the reg-lookup and gateway-refund gaps.
 */
export const requestNdrReattempt = onCall(
  { enforceAppCheck: true, region: 'asia-south1' },
  async (request): Promise<RequestNdrReattemptResult> => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required')
    const buyerId = request.auth.uid

    const parsed = requestNdrReattemptRequestSchema.safeParse(request.data)
    if (!parsed.success) throw new HttpsError('invalid-argument', 'A valid subOrderId is required')

    const db = getFirestore()
    return db.runTransaction(async (tx) => {
      const ctx = await loadSubOrderContext(tx, db, parsed.data.subOrderId)
      if (ctx.subOrder.buyerId !== buyerId) throw new HttpsError('permission-denied', 'not_your_order')
      if (ctx.subOrder.shipment?.ndr?.status !== 'raised') {
        throw new HttpsError('failed-precondition', 'no_open_ndr')
      }

      const sellerSnapshot = await tx.get(db.collection('sellers').doc(ctx.subOrder.sellerId))
      const sellerOwnerUserId = sellerSnapshot.exists ? (sellerSnapshot.data()?.ownerUserId as string | undefined) : undefined
      const sellerOwnerSnapshot = sellerOwnerUserId ? await tx.get(db.collection('users').doc(sellerOwnerUserId)) : undefined
      const sellerLanguage = sellerOwnerSnapshot?.exists && sellerOwnerSnapshot.data()?.preferredLanguage === 'hi' ? 'hi' : 'en'

      const now = Date.now()
      tx.update(ctx.subOrderRef, {
        'shipment.ndr.status': 'reattempt_requested',
        'shipment.ndr.reattemptRequestedAt': now,
        timeline: appendTimelineEntry(
          ctx.subOrder.timeline,
          'ndr_reattempt_requested',
          { type: 'buyer', id: buyerId },
          parsed.data.note,
          now,
        ),
        updatedAt: now,
      })

      if (sellerOwnerUserId) {
        queueNotification(tx, db, {
          userId: sellerOwnerUserId,
          type: 'suborder_ndr_reattempt_requested',
          language: sellerLanguage,
          orderId: ctx.order.id,
          subOrderId: ctx.subOrder.id,
        })
      }

      return { subOrderId: ctx.subOrder.id, ndrStatus: 'reattempt_requested' }
    })
  },
)
