import { brandAuthorizationSchema, catalogPartSchema, listingSchema } from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import { onDocumentWritten } from 'firebase-functions/v2/firestore'
import { findVerifiedBrandAuthorization, toGenuineBadge } from './genuineBadge.js'

/**
 * Whenever a seller's brand authorization becomes verified, or a previously
 * verified one is revoked/rejected, batch-recomputes the "Genuine part"
 * badge on that seller's existing listings — so a listing saved before the
 * authorization existed still gains (or loses) the badge without a re-save.
 * New listings get the badge computed inline at save time instead (see
 * functions/src/listings/persistListing.ts).
 */
export const onBrandAuthorizationWrite = onDocumentWritten(
  { document: 'brandAuthorizations/{authorizationId}', region: 'asia-south1' },
  async (event) => {
    const before = event.data?.before.exists ? event.data.before.data() : undefined
    const after = event.data?.after.exists ? event.data.after.data() : undefined
    if (!after) return

    const wasVerified = before?.status === 'verified'
    const isVerified = after.status === 'verified'
    if (wasVerified === isVerified) return

    const parsed = brandAuthorizationSchema.safeParse({ id: event.params.authorizationId, ...after })
    if (!parsed.success) {
      logger.error('onBrandAuthorizationWrite: doc failed schema validation', { id: event.params.authorizationId, issues: parsed.error.issues })
      return
    }
    const authorization = parsed.data

    const db = getFirestore()
    const listingsSnapshot = await db.collection('listings').where('sellerId', '==', authorization.sellerId).get()
    if (listingsSnapshot.empty) return

    const now = Date.now()
    const batch = db.batch()
    let touched = 0

    for (const doc of listingsSnapshot.docs) {
      const listingParsed = listingSchema.safeParse({ id: doc.id, ...doc.data() })
      if (!listingParsed.success) continue
      const listing = listingParsed.data

      const partSnapshot = await db.collection('catalogParts').doc(listing.partId).get()
      if (!partSnapshot.exists) continue
      const partParsed = catalogPartSchema.safeParse({ id: partSnapshot.id, ...partSnapshot.data() })
      if (!partParsed.success) continue
      const part = partParsed.data

      if (part.brand?.trim().toLowerCase() !== authorization.brandName.trim().toLowerCase()) continue

      const matched = await findVerifiedBrandAuthorization(db, authorization.sellerId, part.brand, part.categorySlug)
      const badge = toGenuineBadge(matched)
      if (badge.verified === Boolean(listing.genuineBadge?.verified)) continue

      batch.update(doc.ref, { genuineBadge: badge, updatedAt: now })
      touched += 1
    }

    if (touched > 0) await batch.commit()
  },
)
