import { addDisputeEvidenceRequestSchema, disputeSchema, sellerSchema } from '@snapspare/shared'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { isAdminRequest, requireUid } from '../orders/authz.js'
import { queueNotificationDirect } from '../orders/notify.js'
import { resolveUserLanguage } from '../seller/notifyLanguage.js'
import { writeAuditLog } from '../util/auditLog.js'

/** Appends one entry to a dispute's evidence timeline (design brief item 7: "a full evidence timeline"). Buyer, the dispute's seller, or an admin — never the resolved/closed side of a settled dispute. */
export const addDisputeEvidence = onCall({ enforceAppCheck: true, region: 'asia-south1' }, async (request): Promise<{ disputeId: string }> => {
  const uid = requireUid(request)
  const sellerId = request.auth?.token.sellerId as string | undefined
  const admin = isAdminRequest(request)

  const parsed = addDisputeEvidenceRequestSchema.safeParse(request.data)
  if (!parsed.success) throw new HttpsError('invalid-argument', 'Valid evidence is required')
  const input = parsed.data

  const db = getFirestore()
  const ref = db.collection('disputes').doc(input.disputeId)
  const snapshot = await ref.get()
  if (!snapshot.exists) throw new HttpsError('not-found', 'dispute_not_found')
  const dispute = disputeSchema.parse({ id: snapshot.id, ...snapshot.data() })

  const isBuyer = uid === dispute.buyerId
  const isSeller = sellerId !== undefined && sellerId === dispute.sellerId
  if (!isBuyer && !isSeller && !admin) throw new HttpsError('permission-denied', 'not_a_participant')
  if (dispute.status === 'resolved') throw new HttpsError('failed-precondition', 'dispute_already_resolved')

  const now = Date.now()
  await ref.update({
    evidence: FieldValue.arrayUnion({ url: input.url, uploadedBy: uid, uploadedAt: now, ...(input.note ? { note: input.note } : {}) }),
    status: dispute.status === 'open' && admin ? 'under_review' : dispute.status,
    updatedAt: now,
  })

  const buyerLanguage = await resolveUserLanguage(db, dispute.buyerId)
  await queueNotificationDirect(db, {
    userId: dispute.buyerId,
    type: 'dispute_evidence_added',
    language: buyerLanguage,
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
        type: 'dispute_evidence_added',
        language: await resolveUserLanguage(db, seller.data.ownerUserId),
        orderId: dispute.orderId,
        subOrderId: dispute.subOrderId,
        disputeId: dispute.id,
      })
    }
  }

  if (admin) {
    await writeAuditLog({
      request,
      action: 'dispute.addEvidence',
      targetType: 'disputes',
      targetId: dispute.id,
      after: { evidenceUrl: input.url },
      note: input.note,
    })
  }

  return { disputeId: dispute.id }
})
