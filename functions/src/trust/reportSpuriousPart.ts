import { reportSpuriousPartRequestSchema, sellerSchema, spuriousReportSchema } from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { queueNotificationDirect } from '../orders/notify.js'
import { resolveUserLanguage } from '../seller/notifyLanguage.js'
import { enforceRateLimit } from '../util/rateLimit.js'
import { stripUndefined } from '../util/stripUndefined.js'

/** Buyer-initiated "report a suspicious part" (design brief item 4), reachable from order and product pages. Evidence images are Storage paths uploaded client-side beforehand — see getSpuriousReportEvidenceUrls.ts for how they're read back. */
export const reportSpuriousPart = onCall({ enforceAppCheck: true, region: 'asia-south1' }, async (request): Promise<{ id: string }> => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required')
  const reporterId = request.auth.uid

  const parsed = reportSpuriousPartRequestSchema.safeParse(request.data)
  if (!parsed.success) throw new HttpsError('invalid-argument', 'A valid report is required')
  const input = parsed.data

  await enforceRateLimit(request, { name: 'reportSpuriousPart', perUidLimit: 10, perIpLimit: 20, windowMinutes: 1440 })

  const db = getFirestore()
  const ref = db.collection('spuriousReports').doc()
  const now = Date.now()

  const { id: _id, ...doc } = spuriousReportSchema.parse({
    id: ref.id,
    reporterId,
    orderId: input.orderId,
    subOrderId: input.subOrderId,
    listingId: input.listingId,
    partId: input.partId,
    sellerId: input.sellerId,
    reasonNotes: input.reasonNotes,
    evidenceImages: input.evidenceImages,
    status: 'submitted',
    createdAt: now,
    updatedAt: now,
  })
  await ref.set(stripUndefined(doc))

  const sellerSnapshot = await db.collection('sellers').doc(input.sellerId).get()
  if (sellerSnapshot.exists) {
    const seller = sellerSchema.safeParse({ id: sellerSnapshot.id, ...sellerSnapshot.data() })
    if (seller.success) {
      await queueNotificationDirect(db, {
        userId: seller.data.ownerUserId,
        type: 'spurious_report_response_requested',
        language: await resolveUserLanguage(db, seller.data.ownerUserId),
        listingId: input.listingId,
        partId: input.partId,
      })
    }
  }

  return { id: ref.id }
})
