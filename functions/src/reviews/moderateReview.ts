import { z } from 'zod'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { isAdminRequest } from '../orders/authz.js'
import { writeAuditLog } from '../util/auditLog.js'

const moderateReviewRequestSchema = z.object({
  reviewId: z.string().min(1),
  action: z.enum(['approve', 'reject']),
  notes: z.string().max(2000).optional(),
})

/** Admin resolution of a flagged review (design brief item 2's admin queue) — 'approve' publishes it despite the automated flag, 'reject' hides it permanently. Either way the flag is cleared so the same review can't clog the queue twice. */
export const moderateReview = onCall({ enforceAppCheck: true, region: 'asia-south1' }, async (request): Promise<{ status: 'published' | 'hidden' }> => {
  if (!request.auth || !isAdminRequest(request)) throw new HttpsError('permission-denied', 'admin_only')
  const adminUid = request.auth.uid

  const parsed = moderateReviewRequestSchema.safeParse(request.data)
  if (!parsed.success) throw new HttpsError('invalid-argument', 'A valid moderation decision is required')
  const input = parsed.data

  const db = getFirestore()
  const ref = db.collection('reviews').doc(input.reviewId)
  const snapshot = await ref.get()
  if (!snapshot.exists) throw new HttpsError('not-found', 'review_not_found')

  const status = input.action === 'approve' ? 'published' : 'hidden'
  const now = Date.now()
  await ref.update({
    status,
    moderationStatus: 'clean',
    reviewedBy: adminUid,
    reviewedAt: now,
    updatedAt: now,
    ...(input.notes ? { adminNotes: input.notes } : {}),
  })
  await writeAuditLog({
    request,
    action: `review.${input.action}`,
    targetType: 'reviews',
    targetId: input.reviewId,
    after: { status },
    note: input.notes,
  })

  return { status }
})
