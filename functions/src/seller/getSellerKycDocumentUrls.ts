import { z } from 'zod'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { isAdminRequest } from '../orders/authz.js'
import { writeAuditLog } from '../util/auditLog.js'

const requestSchema = z.object({ applicationId: z.string().min(1) })
const DOCUMENT_URL_TTL_MS = 15 * 60_000

export interface SellerKycDocumentUrls {
  gstCertificateUrl?: string
  panUrl?: string
  addressProofUrl?: string
  brandAuthLetterUrls: string[]
  shopPhotoUrl?: string
  cancelledChequeUrl?: string
}

/**
 * Admin-only, audited read path for a seller applicant's KYC documents
 * (`sellers/{sellerId}/kyc/**`, storage.rules — write-only for the
 * applicant, so this callable is the only way anyone reads them back).
 * `storage.rules`'s KYC block denies direct client reads even for admins
 * (Phase 23: "access to KYC docs logged") — every view goes through here,
 * gets a short-lived (15 min) signed URL, and is written to `auditLogs`
 * before the URLs are returned, so a support/compliance review of "who
 * looked at this applicant's PAN card" is always answerable. Console/gcloud
 * access with elevated IAM credentials bypasses this by construction (rules
 * only gate the client SDK) — pair with a project-level Cloud Audit Logs
 * Data Access config for that layer; see the security runbook.
 */
export const getSellerKycDocumentUrls = onCall(
  { enforceAppCheck: true, region: 'asia-south1' },
  async (request): Promise<SellerKycDocumentUrls> => {
    if (!isAdminRequest(request)) throw new HttpsError('permission-denied', 'admin_only')

    const parsed = requestSchema.safeParse(request.data)
    if (!parsed.success) throw new HttpsError('invalid-argument', 'A valid applicationId is required')
    const { applicationId } = parsed.data

    const db = getFirestore()
    const snapshot = await db.collection('sellerApplications').doc(applicationId).get()
    if (!snapshot.exists) throw new HttpsError('not-found', 'application_not_found')
    const documents = snapshot.data()?.documents as
      | {
          gstCertificateStoragePath?: string
          panStoragePath?: string
          addressProofStoragePath?: string
          brandAuthLetterStoragePaths?: string[]
          shopPhotoStoragePath?: string
          cancelledChequeStoragePath?: string
        }
      | undefined

    const bucket = getStorage().bucket()
    const sign = async (path: string): Promise<string> => {
      const [url] = await bucket.file(path).getSignedUrl({ action: 'read', expires: Date.now() + DOCUMENT_URL_TTL_MS })
      return url
    }
    const signIfPresent = async (path: string | undefined): Promise<string | undefined> =>
      path ? sign(path) : undefined

    const [gstCertificateUrl, panUrl, addressProofUrl, shopPhotoUrl, cancelledChequeUrl, brandAuthLetterUrls] =
      await Promise.all([
        signIfPresent(documents?.gstCertificateStoragePath),
        signIfPresent(documents?.panStoragePath),
        signIfPresent(documents?.addressProofStoragePath),
        signIfPresent(documents?.shopPhotoStoragePath),
        signIfPresent(documents?.cancelledChequeStoragePath),
        Promise.all((documents?.brandAuthLetterStoragePaths ?? []).map(sign)),
      ])

    await writeAuditLog({
      request,
      action: 'sellerApplication.kycDocumentsViewed',
      targetType: 'sellerApplications',
      targetId: applicationId,
    })

    return { gstCertificateUrl, panUrl, addressProofUrl, brandAuthLetterUrls, shopPhotoUrl, cancelledChequeUrl }
  },
)
