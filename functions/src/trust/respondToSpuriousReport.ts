import { respondToSpuriousReportRequestSchema } from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { requireSellerId } from '../orders/authz.js'

/** Seller's one-time response on a spurious-part report against their own listing (design brief item 4's investigation workflow). */
export const respondToSpuriousReport = onCall({ enforceAppCheck: true, region: 'asia-south1' }, async (request): Promise<{ ok: true }> => {
  const sellerId = requireSellerId(request)

  const parsed = respondToSpuriousReportRequestSchema.safeParse(request.data)
  if (!parsed.success) throw new HttpsError('invalid-argument', 'A valid response is required')
  const input = parsed.data

  const db = getFirestore()
  const ref = db.collection('spuriousReports').doc(input.id)
  const snapshot = await ref.get()
  if (!snapshot.exists) throw new HttpsError('not-found', 'report_not_found')

  const report = snapshot.data() as { sellerId?: string; status?: string; sellerResponse?: unknown }
  if (report.sellerId !== sellerId) throw new HttpsError('permission-denied', 'not_your_report')
  if (report.sellerResponse) throw new HttpsError('already-exists', 'response_already_submitted')
  if (report.status === 'resolved') throw new HttpsError('failed-precondition', 'report_already_resolved')

  await ref.update({
    sellerResponse: { comment: input.comment, respondedAt: Date.now() },
    status: 'seller_responded',
    updatedAt: Date.now(),
  })

  return { ok: true }
})
