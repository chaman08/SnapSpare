import { catalogPartSchema, resolveSpuriousReportRequestSchema, spuriousReportSchema } from '@snapspare/shared'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { isAdminRequest } from '../orders/authz.js'
import { queueNotificationDirect } from '../orders/notify.js'
import { resolveUserLanguage } from '../seller/notifyLanguage.js'
import { writeAuditLog } from '../util/auditLog.js'

/**
 * Admin resolution of a spurious-part report — the penalty ladder (design
 * brief item 4): warning -> listing_removal -> category_ban -> payout_hold
 * -> delisting, or dismissed. Each outcome maps to exactly one server-side
 * effect, applied transactionally alongside the report's own status change
 * so a report can never end up "resolved" without its penalty (or vice
 * versa). 'delisting' reuses `sellers/{id}.status = 'suspended'`, which
 * onSellerStatusChange.ts already turns into a claims revocation — no
 * separate mechanism needed. 'payout_hold' is read by runSellerPayouts.ts,
 * which skips held sellers on its next run.
 */
export const resolveSpuriousReport = onCall({ enforceAppCheck: true, region: 'asia-south1' }, async (request): Promise<{ status: string }> => {
  if (!request.auth || !isAdminRequest(request)) throw new HttpsError('permission-denied', 'admin_only')
  const adminUid = request.auth.uid

  const parsed = resolveSpuriousReportRequestSchema.safeParse(request.data)
  if (!parsed.success) throw new HttpsError('invalid-argument', 'A valid decision is required')
  const input = parsed.data

  const db = getFirestore()
  const ref = db.collection('spuriousReports').doc(input.id)
  const snapshot = await ref.get()
  if (!snapshot.exists) throw new HttpsError('not-found', 'report_not_found')
  const report = spuriousReportSchema.parse({ id: snapshot.id, ...snapshot.data() })
  if (report.status === 'resolved') throw new HttpsError('failed-precondition', 'report_already_resolved')

  const now = Date.now()

  if (input.action === 'start_review') {
    await ref.update({ status: 'under_review', updatedAt: now })
    await writeAuditLog({
      request,
      action: 'spuriousReport.startReview',
      targetType: 'spuriousReports',
      targetId: report.id,
      before: { status: report.status },
      after: { status: 'under_review' },
    })
    return { status: 'under_review' }
  }

  // action === 'resolve'
  const sellerRef = db.collection('sellers').doc(report.sellerId)

  let categorySlug: string | undefined
  if (input.outcome === 'category_ban') {
    const partSnapshot = await db.collection('catalogParts').doc(report.partId).get()
    const part = partSnapshot.exists ? catalogPartSchema.safeParse({ id: partSnapshot.id, ...partSnapshot.data() }) : undefined
    categorySlug = part?.success ? part.data.categorySlug : undefined
  }

  await db.runTransaction(async (tx) => {
    tx.update(ref, {
      status: 'resolved',
      outcome: input.outcome,
      ...(input.adminNotes ? { adminNotes: input.adminNotes } : {}),
      resolvedBy: adminUid,
      resolvedAt: now,
      updatedAt: now,
    })

    switch (input.outcome) {
      case 'warning':
        tx.update(sellerRef, {
          warningsCount: FieldValue.increment(1),
          spuriousReportsCount: FieldValue.increment(1),
          updatedAt: now,
        })
        break
      case 'listing_removal':
        tx.update(db.collection('listings').doc(report.listingId), { status: 'rejected', updatedAt: now })
        tx.update(sellerRef, { spuriousReportsCount: FieldValue.increment(1), updatedAt: now })
        break
      case 'category_ban':
        tx.update(sellerRef, {
          ...(categorySlug ? { bannedCategorySlugs: FieldValue.arrayUnion(categorySlug) } : {}),
          spuriousReportsCount: FieldValue.increment(1),
          updatedAt: now,
        })
        break
      case 'payout_hold':
        tx.update(sellerRef, {
          payoutHold: true,
          payoutHoldReason: `Spurious part report ${report.id}`,
          spuriousReportsCount: FieldValue.increment(1),
          updatedAt: now,
        })
        break
      case 'delisting':
        tx.update(sellerRef, { status: 'suspended', spuriousReportsCount: FieldValue.increment(1), updatedAt: now })
        break
      case 'dismissed':
        break
    }
  })

  await queueNotificationDirect(db, {
    userId: report.reporterId,
    type: 'spurious_report_resolved',
    language: await resolveUserLanguage(db, report.reporterId),
    listingId: report.listingId,
    partId: report.partId,
  })
  await writeAuditLog({
    request,
    action: 'spuriousReport.resolve',
    targetType: 'spuriousReports',
    targetId: report.id,
    before: { status: report.status },
    after: { status: 'resolved', outcome: input.outcome },
    note: input.adminNotes,
  })

  return { status: 'resolved' }
})
