import { catalogPartSchema, listingSchema, verifyPartAuthenticityRequestSchema, type VerifyPartAuthenticityResult } from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { getAuthenticityProvider } from './mockAuthenticityProvider.js'

/** Design brief item 4's QR/hologram scan endpoint — delegates to the provider adapter (see authenticityProvider.ts) and logs every scan for audit. */
export const verifyPartAuthenticity = onCall({ enforceAppCheck: true, region: 'asia-south1' }, async (request): Promise<VerifyPartAuthenticityResult> => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required')
  const uid = request.auth.uid

  const parsed = verifyPartAuthenticityRequestSchema.safeParse(request.data)
  if (!parsed.success) throw new HttpsError('invalid-argument', 'A valid code is required')
  const input = parsed.data

  const db = getFirestore()
  let brandHint: string | undefined
  if (input.listingId) {
    const listingSnapshot = await db.collection('listings').doc(input.listingId).get()
    if (listingSnapshot.exists) {
      const listing = listingSchema.safeParse({ id: listingSnapshot.id, ...listingSnapshot.data() })
      if (listing.success) {
        const partSnapshot = await db.collection('catalogParts').doc(listing.data.partId).get()
        if (partSnapshot.exists) {
          const part = catalogPartSchema.safeParse({ id: partSnapshot.id, ...partSnapshot.data() })
          if (part.success) brandHint = part.data.brand
        }
      }
    }
  }

  const result = await getAuthenticityProvider().verifyCode({ code: input.code, brandHint })

  const now = Date.now()
  await db.collection('authenticityScans').add({
    scannedBy: uid,
    code: input.code,
    ...(input.listingId ? { listingId: input.listingId } : {}),
    valid: result.valid,
    ...(result.brand ? { brand: result.brand } : {}),
    ...(result.message ? { message: result.message } : {}),
    createdAt: now,
  })

  return result
})
