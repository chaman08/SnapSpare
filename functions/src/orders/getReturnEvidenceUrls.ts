import { z } from 'zod'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { isAdminRequest } from './authz.js'
import { writeAuditLog } from '../util/auditLog.js'

const requestSchema = z.object({ returnId: z.string().min(1) })
const EVIDENCE_URL_TTL_MS = 24 * 60 * 60_000

/**
 * Same "signed URL via Admin SDK callable" idiom as
 * getSpuriousReportEvidenceUrls.ts/getWarrantyClaimEvidenceUrls.ts — a
 * return's buyer-submitted evidence photos (storage.rules'
 * `users/{uid}/returns/**`) and the seller's QC photos
 * (`users/{uid}/returnsQc/**`) both live under the buyer's/seller's own
 * uid, so neither party can read the other's directly via Storage rules.
 * Returns both sets together since a participant is always allowed to see
 * both once they can see the return at all.
 */
export const getReturnEvidenceUrls = onCall(
  { enforceAppCheck: true, region: 'asia-south1' },
  async (request): Promise<{ evidenceUrls: string[]; videoUrl?: string; qcPhotoUrls: string[] }> => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required')
    const parsed = requestSchema.safeParse(request.data)
    if (!parsed.success) throw new HttpsError('invalid-argument', 'A valid return id is required')

    const db = getFirestore()
    const snapshot = await db.collection('returns').doc(parsed.data.returnId).get()
    if (!snapshot.exists) throw new HttpsError('not-found', 'return_not_found')
    const ret = snapshot.data() as {
      buyerId?: string
      sellerId?: string
      images?: string[]
      videoPath?: string
      qc?: { photos?: string[] }
    }

    const uid = request.auth.uid
    const sellerId = request.auth.token.sellerId as string | undefined
    const isBuyer = ret.buyerId === uid
    const isOwningSeller = sellerId !== undefined && ret.sellerId === sellerId
    const isAdmin = isAdminRequest(request)
    if (!isBuyer && !isOwningSeller && !isAdmin) {
      throw new HttpsError('permission-denied', 'not_a_participant')
    }
    // Buyer/seller viewing their own submitted evidence isn't logged — the
    // meaningful trail (Phase 23) is an admin looking at a participant's
    // evidence, same rationale as getSellerKycDocumentUrls.ts.
    if (isAdmin) {
      await writeAuditLog({
        request,
        action: 'returns.evidenceViewed',
        targetType: 'returns',
        targetId: parsed.data.returnId,
      })
    }

    const bucket = getStorage().bucket()
    const sign = async (path: string): Promise<string> => {
      const [url] = await bucket.file(path).getSignedUrl({ action: 'read', expires: Date.now() + EVIDENCE_URL_TTL_MS })
      return url
    }

    const [evidenceUrls, qcPhotoUrls, videoUrl] = await Promise.all([
      Promise.all((ret.images ?? []).map(sign)),
      Promise.all((ret.qc?.photos ?? []).map(sign)),
      ret.videoPath ? sign(ret.videoPath) : Promise.resolve(undefined),
    ])

    return { evidenceUrls, qcPhotoUrls, videoUrl }
  },
)
