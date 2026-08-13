import {
  type ReviewPartRequestResult,
  partRequestSchema,
  reviewPartRequestRequestSchema,
  sellerSchema,
} from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { isAdminRequest } from '../orders/authz.js'
import { queueNotificationDirect } from '../orders/notify.js'
import { resolveUserLanguage } from '../seller/notifyLanguage.js'
import { writeAuditLog } from '../util/auditLog.js'
import { stripUndefined } from '../util/stripUndefined.js'
import { persistListing } from './persistListing.js'

/**
 * Admin-only resolution of a submitted part request — mirrors
 * reviewSellerApplication.ts's action pattern exactly
 * (start_review/request_changes/reject/approve). `approve` is the one
 * action with real side effects: it creates `catalogParts/{id}` (Admin SDK,
 * bypasses the admin-only catalogParts rule the same way any Admin SDK
 * write does) and calls `persistListing.ts` to create a linked `draft`
 * stub listing for the requesting seller, auto-linking them per
 * requirement 2. Admin-confirmed `partNumber`/`hsnCode`/`gstRatePercent`
 * are required at approval — a seller's submission is a proposal, not an
 * authoritative catalogue entry.
 */
export const reviewPartRequest = onCall(
  { enforceAppCheck: true, region: 'asia-south1' },
  async (request): Promise<ReviewPartRequestResult> => {
    if (!request.auth || !isAdminRequest(request)) throw new HttpsError('permission-denied', 'admin_only')
    const adminUid = request.auth.uid

    const parsed = reviewPartRequestRequestSchema.safeParse(request.data)
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', parsed.error.issues[0]?.message ?? 'invalid_request', {
        issues: parsed.error.issues,
      })
    }
    const input = parsed.data

    const db = getFirestore()
    const ref = db.collection('partRequests').doc(input.requestId)
    const snapshot = await ref.get()
    if (!snapshot.exists) throw new HttpsError('not-found', 'request_not_found')
    const partRequest = partRequestSchema.parse({ id: snapshot.id, ...snapshot.data() })

    if (!['pending', 'under_review', 'changes_requested'].includes(partRequest.status)) {
      throw new HttpsError('failed-precondition', 'request_not_reviewable')
    }

    const sellerSnapshot = await db.collection('sellers').doc(partRequest.sellerId).get()
    if (!sellerSnapshot.exists) throw new HttpsError('not-found', 'seller_not_found')
    const seller = sellerSchema.parse({ id: sellerSnapshot.id, ...sellerSnapshot.data() })
    const language = await resolveUserLanguage(db, seller.ownerUserId)

    const now = Date.now()

    if (input.action === 'start_review') {
      await ref.update({ status: 'under_review', reviewedBy: adminUid, updatedAt: now })
      await writeAuditLog({
        request,
        action: 'partRequest.startReview',
        targetType: 'partRequests',
        targetId: partRequest.id,
        before: { status: partRequest.status },
        after: { status: 'under_review' },
      })
      return { status: 'under_review' }
    }

    if (input.action === 'request_changes') {
      if (!input.message) throw new HttpsError('invalid-argument', 'message_required')
      await ref.update({
        status: 'changes_requested',
        reviewNotes: [...partRequest.reviewNotes, { message: input.message, createdAt: now }],
        reviewedBy: adminUid,
        reviewedAt: now,
        updatedAt: now,
      })
      await queueNotificationDirect(db, { userId: seller.ownerUserId, type: 'part_request_changes_requested', language })
      await writeAuditLog({
        request,
        action: 'partRequest.requestChanges',
        targetType: 'partRequests',
        targetId: partRequest.id,
        before: { status: partRequest.status },
        after: { status: 'changes_requested' },
        note: input.message,
      })
      return { status: 'changes_requested' }
    }

    if (input.action === 'reject') {
      const notes = input.message ? [{ message: input.message, createdAt: now }] : []
      await ref.update({
        status: 'rejected',
        reviewNotes: [...partRequest.reviewNotes, ...notes],
        reviewedBy: adminUid,
        reviewedAt: now,
        updatedAt: now,
      })
      await queueNotificationDirect(db, { userId: seller.ownerUserId, type: 'part_request_rejected', language })
      await writeAuditLog({
        request,
        action: 'partRequest.reject',
        targetType: 'partRequests',
        targetId: partRequest.id,
        before: { status: partRequest.status },
        after: { status: 'rejected' },
        note: input.message,
      })
      return { status: 'rejected' }
    }

    // action === 'approve'
    const partNumber = input.approvedPartNumber
    if (!partNumber) throw new HttpsError('invalid-argument', 'approvedPartNumber_required')
    const hsnCode = input.approvedHsnCode ?? partRequest.hsnCode
    if (!hsnCode) throw new HttpsError('invalid-argument', 'approvedHsnCode_required')
    const gstRatePercent = input.approvedGstRatePercent ?? partRequest.gstRatePercent
    if (gstRatePercent === undefined) throw new HttpsError('invalid-argument', 'approvedGstRatePercent_required')

    const partRef = db.collection('catalogParts').doc()
    await partRef.set(
      stripUndefined({
        partNumber,
        partType: partRequest.partType,
        categorySlug: partRequest.categorySlug,
        subcategorySlug: partRequest.subcategorySlug,
        name: partRequest.title,
        description: partRequest.description,
        brand: partRequest.brand,
        oemNumbers: partRequest.oemNumber ? [partRequest.oemNumber] : [],
        crossRefNumbers: [],
        hsnCode,
        gstRatePercent,
        attributes: partRequest.attributes,
        images: partRequest.images,
        fitmentSummary: { modelIds: [] },
        status: 'active',
        createdAt: now,
        updatedAt: now,
      }),
    )

    const { id: listingId } = await persistListing({
      sellerId: partRequest.sellerId,
      input: {
        partId: partRef.id,
        sku: partNumber,
        title: partRequest.title,
        condition: 'new',
        stockQty: 0,
        pricing: { moq: 1, stepQty: 1, tiers: [{ minQty: 1, maxQty: null, unitPricePaise: 0 }] },
        taxIncluded: true,
        hsnCode,
        gstRatePercent,
        isOversized: false,
        images: partRequest.images,
        isFeatured: false,
      },
    })

    await ref.update({
      status: 'approved',
      reviewedBy: adminUid,
      reviewedAt: now,
      updatedAt: now,
      linkedPartId: partRef.id,
      linkedListingId: listingId,
    })

    await queueNotificationDirect(db, { userId: seller.ownerUserId, type: 'part_request_approved', language })
    await writeAuditLog({
      request,
      action: 'partRequest.approve',
      targetType: 'partRequests',
      targetId: partRequest.id,
      before: { status: partRequest.status },
      after: { status: 'approved', linkedPartId: partRef.id, linkedListingId: listingId },
    })

    return { status: 'approved', linkedPartId: partRef.id, linkedListingId: listingId }
  },
)
