import { brandAuthorizationSchema, submitBrandAuthorizationRequestSchema } from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { requireSellerId } from '../orders/authz.js'
import { stripUndefined } from '../util/stripUndefined.js'

/** Seller submits a brand-authorization document for admin review — design brief item 4: "Never award a badge without a document." documentUrl is uploaded client-side beforehand (see storage.rules' sellers/{sellerId}/brandAuthorizations/** rule). */
export const submitBrandAuthorization = onCall({ enforceAppCheck: true, region: 'asia-south1' }, async (request): Promise<{ id: string }> => {
  const sellerId = requireSellerId(request)

  const parsed = submitBrandAuthorizationRequestSchema.safeParse(request.data)
  if (!parsed.success) throw new HttpsError('invalid-argument', 'A valid brand authorization is required')
  const input = parsed.data

  const db = getFirestore()
  const ref = db.collection('brandAuthorizations').doc()
  const now = Date.now()

  const { id: _id, ...doc } = brandAuthorizationSchema.parse({
    id: ref.id,
    sellerId,
    brandName: input.brandName,
    categorySlugs: input.categorySlugs,
    documentUrl: input.documentUrl,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  })
  await ref.set(stripUndefined(doc))

  return { id: ref.id }
})
