import {
  type DecideWarrantyClaimResult,
  decideWarrantyClaimRequestSchema,
  warrantyClaimSchema,
} from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { isAdminRequest } from '../orders/authz.js'
import { queueNotificationDirect } from '../orders/notify.js'
import { executeRefund } from '../payments/refundEngine.js'
import { resolveUserLanguage } from '../seller/notifyLanguage.js'
import { writeAuditLog } from '../util/auditLog.js'
import { stripUndefined } from '../util/stripUndefined.js'

/**
 * Seller/admin review of a warranty claim (design brief item 6):
 * `approve`/`reject` records the seller's (or admin's) call; `escalate_to_brand`
 * routes it into an admin-visible queue with no automated brand contact —
 * this system has no brand-contact directory (see warrantyClaim.ts's
 * status doc comment), so an admin handles the actual brand conversation
 * offline and later calls `resolve` (admin only) to record the outcome. A
 * `resolve` with resolutionType 'refund' moves money via the same
 * executeRefund path returns use, with an explicit amount (not derived from
 * computeLineRefund — a warranty payout is a goodwill/brand-driven amount,
 * not a proportional-return calculation).
 */
export const decideWarrantyClaim = onCall({ enforceAppCheck: true, region: 'asia-south1' }, async (request): Promise<DecideWarrantyClaimResult> => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required')
  const sellerId = request.auth.token.sellerId as string | undefined
  const admin = isAdminRequest(request)
  if (!sellerId && !admin) throw new HttpsError('permission-denied', 'seller_or_admin_only')

  const parsed = decideWarrantyClaimRequestSchema.safeParse(request.data)
  if (!parsed.success) throw new HttpsError('invalid-argument', 'A valid decision is required')
  const input = parsed.data

  const db = getFirestore()
  const ref = db.collection('warrantyClaims').doc(input.claimId)
  const snapshot = await ref.get()
  if (!snapshot.exists) throw new HttpsError('not-found', 'claim_not_found')
  const claim = warrantyClaimSchema.parse({ id: snapshot.id, ...snapshot.data() })
  if (!admin && claim.sellerId !== sellerId) throw new HttpsError('permission-denied', 'not_your_claim')

  const now = Date.now()

  if (input.action === 'approve' || input.action === 'reject') {
    if (claim.status !== 'submitted' && claim.status !== 'seller_review') {
      throw new HttpsError('failed-precondition', 'claim_not_reviewable')
    }
    const outcome = input.action === 'approve' ? 'approved' : 'rejected'
    await ref.update(
      stripUndefined({
        status: outcome,
        sellerDecision: { outcome, note: input.note, decidedAt: now },
        updatedAt: now,
      }),
    )
    await queueNotificationDirect(db, {
      userId: claim.buyerId,
      type: 'warranty_claim_decided',
      language: await resolveUserLanguage(db, claim.buyerId),
      orderId: claim.orderId,
      subOrderId: claim.subOrderId,
      warrantyClaimId: claim.id,
      copyInput: { reason: outcome },
    })
    if (admin) {
      await writeAuditLog({
        request,
        action: `warrantyClaim.${input.action}`,
        targetType: 'warrantyClaims',
        targetId: claim.id,
        before: { status: claim.status },
        after: { status: outcome },
        note: input.note,
      })
    }
    return { claimId: claim.id, status: outcome }
  }

  if (input.action === 'escalate_to_brand') {
    if (claim.status !== 'submitted' && claim.status !== 'seller_review' && claim.status !== 'approved') {
      throw new HttpsError('failed-precondition', 'claim_not_reviewable')
    }
    await ref.update({ status: 'escalated_to_brand', escalatedToBrandAt: now, updatedAt: now })
    if (admin) {
      await writeAuditLog({
        request,
        action: 'warrantyClaim.escalateToBrand',
        targetType: 'warrantyClaims',
        targetId: claim.id,
        before: { status: claim.status },
        after: { status: 'escalated_to_brand' },
      })
    }
    // Admin-mediated only — no brand-contact directory exists in this system.
    // Routes into the admin warranty-claims queue (filtered by status); an
    // admin handles the actual brand conversation offline.
    return { claimId: claim.id, status: 'escalated_to_brand' }
  }

  // action === 'resolve' — admin only, from an approved or brand-escalated claim.
  if (!admin) throw new HttpsError('permission-denied', 'admin_only')
  if (claim.status !== 'approved' && claim.status !== 'escalated_to_brand') {
    throw new HttpsError('failed-precondition', 'claim_not_resolvable')
  }

  await ref.update({
    status: 'resolved',
    resolution: {
      type: input.resolutionType,
      amountPaise: input.amountPaise,
      note: input.note,
      resolvedBy: request.auth.uid,
      resolvedAt: now,
    },
    updatedAt: now,
  })

  if (input.resolutionType === 'refund' && input.amountPaise !== undefined && input.amountPaise > 0) {
    try {
      await executeRefund({
        orderId: claim.orderId,
        subOrderId: claim.subOrderId,
        items: [{ listingId: claim.listingId, qty: 1 }],
        reason: 'warranty_claim',
        overrideAmountPaise: input.amountPaise,
        ledgerEntryOverride: {
          type: 'refund_debit',
          referenceType: 'subOrder',
          referenceId: claim.subOrderId,
          description: `Warranty claim ${claim.id} resolution: ${input.note}`,
        },
      })
    } catch (error) {
      logger.error('decideWarrantyClaim: warranty refund failed', {
        claimId: claim.id,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  await queueNotificationDirect(db, {
    userId: claim.buyerId,
    type: 'warranty_claim_decided',
    language: await resolveUserLanguage(db, claim.buyerId),
    orderId: claim.orderId,
    subOrderId: claim.subOrderId,
    warrantyClaimId: claim.id,
    copyInput: { reason: 'resolved' },
  })
  await writeAuditLog({
    request,
    action: 'warrantyClaim.resolve',
    targetType: 'warrantyClaims',
    targetId: claim.id,
    before: { status: claim.status },
    after: { status: 'resolved', resolutionType: input.resolutionType, amountPaise: input.amountPaise },
    note: input.note,
  })

  return { claimId: claim.id, status: 'resolved' }
})
