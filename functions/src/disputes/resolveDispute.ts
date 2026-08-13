import { disputeSchema, type ResolveDisputeResult, resolveDisputeRequestSchema, returnSchema, sellerSchema, warrantyClaimSchema } from '@snapspare/shared'
import { type Firestore, getFirestore } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { isAdminRequest } from '../orders/authz.js'
import { queueNotificationDirect } from '../orders/notify.js'
import { executeRefund } from '../payments/refundEngine.js'
import { resolveUserLanguage } from '../seller/notifyLanguage.js'
import { writeAuditLog } from '../util/auditLog.js'

/**
 * Admin forced resolution (design brief item 7): "admin can refund from the
 * platform and debit the seller ledger, with a mandatory note." `adminNote`
 * is `.min(1)`-enforced by resolveDisputeRequestSchema, not just a
 * convention. `refund_buyer`/`partial_refund` move money via executeRefund
 * with an explicit `overrideAmountPaise` (the admin's chosen amount, not a
 * proportional-return calculation) and a `ledgerEntryOverride` tagging the
 * seller-ledger debit as `dispute_refund_debit` — distinct from an ordinary
 * `refund_debit` — with the admin's note as its description, so a seller's
 * ledger view can tell an admin-forced dispute payout apart from a normal
 * return. The linked return/claim (if any) is closed out in the same write.
 */
export const resolveDispute = onCall({ enforceAppCheck: true, region: 'asia-south1' }, async (request): Promise<ResolveDisputeResult> => {
  if (!request.auth || !isAdminRequest(request)) throw new HttpsError('permission-denied', 'admin_only')
  const adminUid = request.auth.uid

  const parsed = resolveDisputeRequestSchema.safeParse(request.data)
  if (!parsed.success) throw new HttpsError('invalid-argument', 'A valid resolution with a note is required')
  const input = parsed.data

  const db = getFirestore()
  const ref = db.collection('disputes').doc(input.disputeId)
  const snapshot = await ref.get()
  if (!snapshot.exists) throw new HttpsError('not-found', 'dispute_not_found')
  const dispute = disputeSchema.parse({ id: snapshot.id, ...snapshot.data() })
  if (dispute.status === 'resolved') throw new HttpsError('failed-precondition', 'dispute_already_resolved')

  if ((input.action === 'refund_buyer' || input.action === 'partial_refund') && !input.refundAmountPaise) {
    throw new HttpsError('invalid-argument', 'refundAmountPaise is required for a refund outcome')
  }

  const now = Date.now()
  await ref.update({
    status: 'resolved',
    resolution: {
      action: input.action,
      refundAmountPaise: input.refundAmountPaise,
      adminNote: input.adminNote,
      resolvedBy: adminUid,
      resolvedAt: now,
    },
    updatedAt: now,
  })

  if (dispute.returnId) {
    await db.collection('returns').doc(dispute.returnId).update({ status: 'closed', resolvedAt: now, updatedAt: now })
  }
  if (dispute.warrantyClaimId) {
    await db.collection('warrantyClaims').doc(dispute.warrantyClaimId).update({
      status: 'resolved',
      resolution: { type: 'refund', amountPaise: input.refundAmountPaise, note: input.adminNote, resolvedBy: adminUid, resolvedAt: now },
      updatedAt: now,
    })
  }

  if ((input.action === 'refund_buyer' || input.action === 'partial_refund') && input.refundAmountPaise) {
    try {
      await executeRefund({
        orderId: dispute.orderId,
        subOrderId: dispute.subOrderId,
        items: await resolveDisputeRefundItems(db, dispute),
        reason: 'dispute',
        overrideAmountPaise: input.refundAmountPaise,
        ledgerEntryOverride: {
          type: 'dispute_refund_debit',
          referenceType: 'dispute',
          referenceId: dispute.id,
          description: input.adminNote,
        },
      })
    } catch (error) {
      logger.error('resolveDispute: forced refund failed', {
        disputeId: dispute.id,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  await writeAuditLog({
    request,
    action: 'dispute.resolve',
    targetType: 'disputes',
    targetId: dispute.id,
    before: { status: dispute.status },
    after: { status: 'resolved', action: input.action, refundAmountPaise: input.refundAmountPaise },
    note: input.adminNote,
  })

  await queueNotificationDirect(db, {
    userId: dispute.buyerId,
    type: 'dispute_resolved',
    language: await resolveUserLanguage(db, dispute.buyerId),
    orderId: dispute.orderId,
    subOrderId: dispute.subOrderId,
    disputeId: dispute.id,
  })
  const sellerSnapshot = await db.collection('sellers').doc(dispute.sellerId).get()
  if (sellerSnapshot.exists) {
    const seller = sellerSchema.safeParse({ id: sellerSnapshot.id, ...sellerSnapshot.data() })
    if (seller.success) {
      await queueNotificationDirect(db, {
        userId: seller.data.ownerUserId,
        type: 'dispute_resolved',
        language: await resolveUserLanguage(db, seller.data.ownerUserId),
        orderId: dispute.orderId,
        subOrderId: dispute.subOrderId,
        disputeId: dispute.id,
      })
    }
  }

  return { disputeId: dispute.id, status: 'resolved' }
})

/**
 * executeRefund validates every referenced listingId belongs to the
 * subOrder — resolve the dispute's linked return/claim listingId (if any)
 * so that check has something real to validate against; falls back to the
 * subOrder's first line item for a generic ('other') dispute with no linked
 * return/claim.
 */
async function resolveDisputeRefundItems(
  db: Firestore,
  dispute: ReturnType<typeof disputeSchema.parse>,
): Promise<{ listingId: string; qty: number }[]> {
  if (dispute.returnId) {
    const snapshot = await db.collection('returns').doc(dispute.returnId).get()
    if (snapshot.exists) {
      const ret = returnSchema.parse({ id: snapshot.id, ...snapshot.data() })
      return [{ listingId: ret.listingId, qty: ret.qty }]
    }
  }
  if (dispute.warrantyClaimId) {
    const snapshot = await db.collection('warrantyClaims').doc(dispute.warrantyClaimId).get()
    if (snapshot.exists) {
      const claim = warrantyClaimSchema.parse({ id: snapshot.id, ...snapshot.data() })
      return [{ listingId: claim.listingId, qty: 1 }]
    }
  }
  const subOrderSnapshot = await db.collection('subOrders').doc(dispute.subOrderId).get()
  const items = (subOrderSnapshot.data()?.items as { listingId: string }[] | undefined) ?? []
  const first = items[0]
  if (!first) throw new HttpsError('failed-precondition', 'subOrder_has_no_items')
  return [{ listingId: first.listingId, qty: 1 }]
}
