import {
  type SubmitSellerApplicationResult,
  sellerApplicationSchema,
  sellerApplicationSubmitSchema,
} from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { queueNotificationDirect } from '../orders/notify.js'
import { resolveUserLanguage } from './notifyLanguage.js'

function requestIp(request: { rawRequest: { headers: Record<string, unknown>; ip?: string } }): string | undefined {
  const forwarded = request.rawRequest.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.length > 0) return forwarded.split(',')[0]?.trim()
  return request.rawRequest.ip
}

/**
 * Owner-only: flips a seller application from draft/changes_requested to
 * submitted. The wizard only validates one step at a time client-side (see
 * sellerApplicationSchema, whose per-step fields are all optional so partial
 * drafts still parse) — this is the single place the *complete* shape
 * (sellerApplicationSubmitSchema) is enforced, and the only place an IP
 * address can reliably be captured for the agreement record (the client
 * can't attest its own IP).
 */
export const submitSellerApplication = onCall(
  { enforceAppCheck: true, region: 'asia-south1' },
  async (request): Promise<SubmitSellerApplicationResult> => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required')
    const uid = request.auth.uid

    const db = getFirestore()
    const ref = db.collection('sellerApplications').doc(uid)
    const snapshot = await ref.get()
    if (!snapshot.exists) throw new HttpsError('failed-precondition', 'no_draft_application')

    const draft = sellerApplicationSchema.parse({ id: snapshot.id, ...snapshot.data() })
    if (draft.status !== 'draft' && draft.status !== 'changes_requested') {
      throw new HttpsError('failed-precondition', 'application_not_editable')
    }

    const parsed = sellerApplicationSubmitSchema.safeParse({
      business: draft.business,
      taxIdentity: draft.taxIdentity,
      registeredAddress: draft.registeredAddress,
      pickupAddresses: draft.pickupAddresses,
      bank: draft.bank,
      documents: draft.documents,
      agreement: request.data,
    })
    if (!parsed.success) {
      throw new HttpsError('failed-precondition', `application_incomplete: ${parsed.error.issues[0]?.message ?? 'invalid'}`)
    }

    const now = Date.now()
    await ref.update({
      status: 'submitted',
      submittedAt: now,
      updatedAt: now,
      agreement: {
        accepted: true,
        version: parsed.data.agreement.version,
        acceptedAt: now,
        ip: requestIp(request) ?? 'unknown',
      },
    })

    await queueNotificationDirect(db, {
      userId: uid,
      type: 'seller_application_submitted',
      language: await resolveUserLanguage(db, uid),
    })

    return { status: 'submitted' }
  },
)
