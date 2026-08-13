import { returnSchema, type SubmitReturnQcResult, submitReturnQcRequestSchema } from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { logger } from 'firebase-functions'
import { isAdminRequest } from './authz.js'
import { resolveReturnQcPassInTx } from './resolveReturnQcPass.js'
import { appendTimelineEntry } from './timeline.js'
import { executeRefund } from '../payments/refundEngine.js'
import { writeAuditLog } from '../util/auditLog.js'

/**
 * Seller (or admin) records the outcome of inspecting a physically-received
 * return — "received/inspected, uploads QC photos, accepts or disputes"
 * (design brief item 3). Valid only from `approved` (reverse pickup already
 * booked by decideReturn.ts). `pass` immediately resolves the return
 * (refund or replacement, via resolveReturnQcPassInTx — the same helper
 * autoPassReturnQc.ts uses for the seller-missed-the-window case); `dispute`
 * just records the disagreement so buyer/seller can escalate via
 * disputes/openDispute.ts.
 */
export const submitReturnQc = onCall({ enforceAppCheck: true, region: 'asia-south1' }, async (request): Promise<SubmitReturnQcResult> => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required')
  const sellerId = request.auth.token.sellerId as string | undefined
  const admin = isAdminRequest(request)
  if (!sellerId && !admin) throw new HttpsError('permission-denied', 'seller_or_admin_only')

  const parsed = submitReturnQcRequestSchema.safeParse(request.data)
  if (!parsed.success) throw new HttpsError('invalid-argument', 'A valid QC outcome is required')
  const input = parsed.data

  const db = getFirestore()
  const actor = admin ? { type: 'admin' as const, id: request.auth.uid } : { type: 'seller' as const, id: sellerId }

  const result = await db.runTransaction(async (tx) => {
    const returnRef = db.collection('returns').doc(input.returnId)
    const returnSnapshot = await tx.get(returnRef)
    if (!returnSnapshot.exists) throw new HttpsError('not-found', 'return_not_found')
    const ret = returnSchema.parse({ id: returnSnapshot.id, ...returnSnapshot.data() })
    if (!admin && ret.sellerId !== sellerId) throw new HttpsError('permission-denied', 'not_your_return')
    if (ret.status !== 'approved') throw new HttpsError('failed-precondition', 'return_not_approved')

    const now = Date.now()
    const qc = { outcome: input.outcome, photos: input.photos, note: input.note, decidedBy: actor.id ?? 'system', decidedAt: now } as const

    if (input.outcome === 'dispute') {
      // Notification is queued by onReturnStatusChange.ts's generic
      // status-change trigger, not here — avoids double-notifying.
      tx.update(returnRef, {
        status: 'qc_disputed',
        qc,
        timeline: appendTimelineEntry(ret.timeline, 'qc_disputed', actor, input.note, now),
        updatedAt: now,
      })
      return { returnId: ret.id, status: 'qc_disputed' as const, resolution: undefined }
    }

    const resolution = await resolveReturnQcPassInTx(tx, db, ret, qc, actor, now)
    return {
      returnId: ret.id,
      status: resolution.resolutionPreference === 'refund' ? ('refunded' as const) : ('replaced' as const),
      resolution,
    }
  })

  if (result.resolution && result.resolution.resolutionPreference === 'refund') {
    const resolution = result.resolution
    try {
      await executeRefund({
        orderId: resolution.orderId,
        subOrderId: resolution.subOrderId,
        items: [{ listingId: resolution.listingId, qty: resolution.qty }],
        returnId: result.returnId,
        reason: 'return',
      })
    } catch (error) {
      logger.error('submitReturnQc: refund failed', {
        returnId: result.returnId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  if (admin) {
    await writeAuditLog({
      request,
      action: 'return.submitQc',
      targetType: 'returns',
      targetId: result.returnId,
      after: { status: result.status },
    })
  }

  return { returnId: result.returnId, status: result.status }
})
