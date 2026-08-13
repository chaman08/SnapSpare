import { z } from 'zod'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { isAdminRequest } from '../orders/authz.js'
import { writeAuditLog } from '../util/auditLog.js'

const requestSchema = z.object({ id: z.string().min(1) })
const EVIDENCE_URL_TTL_MS = 24 * 60 * 60_000

/**
 * Evidence photos are private (storage.rules scopes `users/{uid}/spuriousReports/**`
 * to the reporter + admin only) so the accused seller can't reach them via a
 * direct Storage read — this is the sanctioned path, same "signed URL via
 * Admin SDK callable" idiom as getInvoiceUrl.ts/generateShippingLabel.ts.
 */
export const getSpuriousReportEvidenceUrls = onCall({ enforceAppCheck: true, region: 'asia-south1' }, async (request): Promise<{ urls: string[] }> => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required')
  const parsed = requestSchema.safeParse(request.data)
  if (!parsed.success) throw new HttpsError('invalid-argument', 'A valid report id is required')

  const db = getFirestore()
  const snapshot = await db.collection('spuriousReports').doc(parsed.data.id).get()
  if (!snapshot.exists) throw new HttpsError('not-found', 'report_not_found')
  const report = snapshot.data() as { reporterId?: string; sellerId?: string; evidenceImages?: string[] }

  const uid = request.auth.uid
  const sellerId = request.auth.token.sellerId as string | undefined
  const isReporter = report.reporterId === uid
  const isAccusedSeller = sellerId !== undefined && report.sellerId === sellerId
  const isAdmin = isAdminRequest(request)
  if (!isReporter && !isAccusedSeller && !isAdmin) {
    throw new HttpsError('permission-denied', 'not_a_participant')
  }
  if (isAdmin) {
    await writeAuditLog({
      request,
      action: 'spuriousReports.evidenceViewed',
      targetType: 'spuriousReports',
      targetId: parsed.data.id,
    })
  }

  const bucket = getStorage().bucket()
  const urls = await Promise.all(
    (report.evidenceImages ?? []).map(async (path) => {
      const [url] = await bucket.file(path).getSignedUrl({ action: 'read', expires: Date.now() + EVIDENCE_URL_TTL_MS })
      return url
    }),
  )

  return { urls }
})
