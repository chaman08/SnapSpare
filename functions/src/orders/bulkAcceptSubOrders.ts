import {
  bulkAcceptSubOrdersRequestSchema,
  type BulkAcceptSubOrdersResult,
  isSubOrderTransitionAllowed,
} from '@snapspare/shared'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { requireSellerId } from './authz.js'
import { loadSubOrderContext } from './loadContext.js'
import { queueNotification } from './notify.js'
import { appendTimelineEntry } from './timeline.js'

/**
 * Seller order queue's "Accept all new" bulk action. Each subOrder is
 * accepted in its own transaction (so one seller-doesn't-own-this-one or
 * already-accepted-by-a-double-click failure can't roll back the rest) and
 * the per-id outcome is reported back so the UI can show exactly which ones
 * succeeded.
 */
export const bulkAcceptSubOrders = onCall(
  { enforceAppCheck: true, region: 'asia-south1' },
  async (request): Promise<BulkAcceptSubOrdersResult> => {
    const sellerId = requireSellerId(request)
    const parsed = bulkAcceptSubOrdersRequestSchema.safeParse(request.data)
    if (!parsed.success) throw new HttpsError('invalid-argument', 'At least one subOrderId is required')

    const db = getFirestore()
    const accepted: string[] = []
    const failed: Array<{ subOrderId: string; reason: string }> = []

    for (const subOrderId of parsed.data.subOrderIds) {
      try {
        await db.runTransaction(async (tx) => {
          const ctx = await loadSubOrderContext(tx, db, subOrderId)
          if (ctx.subOrder.sellerId !== sellerId) throw new HttpsError('permission-denied', 'not_your_suborder')
          if (!isSubOrderTransitionAllowed(ctx.subOrder.status, 'accepted', 'seller')) {
            throw new HttpsError('failed-precondition', 'invalid_transition')
          }

          const now = Date.now()
          tx.update(ctx.subOrderRef, {
            status: 'accepted',
            slaAcceptByAt: FieldValue.delete(),
            timeline: appendTimelineEntry(
              ctx.subOrder.timeline,
              'accepted',
              { type: 'seller', id: sellerId },
              undefined,
              now,
            ),
            updatedAt: now,
          })
          queueNotification(tx, db, {
            userId: ctx.subOrder.buyerId,
            type: 'suborder_accepted',
            language: ctx.buyerLanguage,
            orderId: ctx.order.id,
            subOrderId: ctx.subOrder.id,
          })
        })
        accepted.push(subOrderId)
      } catch (error) {
        failed.push({ subOrderId, reason: error instanceof HttpsError ? error.message : 'unknown_error' })
      }
    }

    return { accepted, failed }
  },
)
