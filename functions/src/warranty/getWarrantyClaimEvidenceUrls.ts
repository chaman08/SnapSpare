import { z } from 'zod'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { isAdminRequest } from '../orders/authz.js'
import { writeAuditLog } from '../util/auditLog.js'

const requestSchema = z.object({ claimId: z.string().min(1) })
const EVIDENCE_URL_TTL_MS = 24 * 60 * 60_000

/**
 * Same "signed URL via Admin SDK callable" idiom as
 * getSpuriousReportEvidenceUrls.ts — evidence photos are private
 * (storage.rules scopes `users/{uid}/warrantyClaims/**` to the claimant +
 * admin only) so the seller can't reach them via a direct Storage read.
 */
export const getWarrantyClaimEvidenceUrls = onCall(
  { enforceAppCheck: true, region: 'asia-south1' },
  async (request): Promise<{ urls: string[]; videoUrl?: string }> => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required')
    const parsed = requestSchema.safeParse(request.data)
    if (!parsed.success) throw new HttpsError('invalid-argument', 'A valid claim id is required')

    const db = getFirestore()
    const snapshot = await db.collection('warrantyClaims').doc(parsed.data.claimId).get()
    if (!snapshot.exists) throw new HttpsError('not-found', 'claim_not_found')
    const claim = snapshot.data() as {
      buyerId?: string
      sellerId?: string
      evidenceImages?: string[]
      evidenceVideoPath?: string
    }

    const uid = request.auth.uid
    const sellerId = request.auth.token.sellerId as string | undefined
    const isBuyer = claim.buyerId === uid
    const isOwningSeller = sellerId !== undefined && claim.sellerId === sellerId
    const isAdmin = isAdminRequest(request)
    if (!isBuyer && !isOwningSeller && !isAdmin) {
      throw new HttpsError('permission-denied', 'not_a_participant')
    }
    if (isAdmin) {
      await writeAuditLog({
        request,
        action: 'warrantyClaims.evidenceViewed',
        targetType: 'warrantyClaims',
        targetId: parsed.data.claimId,
      })
    }

    const bucket = getStorage().bucket()
    const sign = async (path: string): Promise<string> => {
      const [url] = await bucket.file(path).getSignedUrl({ action: 'read', expires: Date.now() + EVIDENCE_URL_TTL_MS })
      return url
    }

    const [urls, videoUrl] = await Promise.all([
      Promise.all((claim.evidenceImages ?? []).map(sign)),
      claim.evidenceVideoPath ? sign(claim.evidenceVideoPath) : Promise.resolve(undefined),
    ])

    return { urls, videoUrl }
  },
)
