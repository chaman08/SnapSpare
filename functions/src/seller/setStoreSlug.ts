import { type SetStoreSlugResult, setStoreSlugRequestSchema } from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { requireSellerPermission } from './staffAuthz.js'

/**
 * Atomically claims a public store handle (requirement 7) — mirrors any
 * "claim a unique username" shape: reserve the slug in
 * `storeSlugReservations/{slug}` (the public /store/:sellerSlug route's
 * slug-to-sellerId lookup) and stamp it onto the seller's public-safe
 * settings doc in the same transaction, releasing whichever slug this
 * seller held before (a seller can rename their store handle, but only
 * ever holds one at a time).
 */
export const setStoreSlug = onCall(
  { enforceAppCheck: true, region: 'asia-south1' },
  async (request): Promise<SetStoreSlugResult> => {
    const sellerId = requireSellerPermission(request, 'manage_listings')

    const parsed = setStoreSlugRequestSchema.safeParse(request.data)
    if (!parsed.success) throw new HttpsError('invalid-argument', parsed.error.issues[0]?.message ?? 'invalid_request')
    const { slug } = parsed.data

    const db = getFirestore()
    const reservationRef = db.collection('storeSlugReservations').doc(slug)
    const settingsRef = db.collection('sellers').doc(sellerId).collection('settings').doc('general')

    await db.runTransaction(async (tx) => {
      const [reservationSnapshot, settingsSnapshot] = await Promise.all([tx.get(reservationRef), tx.get(settingsRef)])

      if (reservationSnapshot.exists && reservationSnapshot.data()?.sellerId !== sellerId) {
        throw new HttpsError('already-exists', 'slug_taken')
      }

      const previousSlug = settingsSnapshot.data()?.storeSlug as string | undefined
      const now = Date.now()

      if (previousSlug && previousSlug !== slug) {
        tx.delete(db.collection('storeSlugReservations').doc(previousSlug))
      }
      tx.set(reservationRef, { sellerId, claimedAt: now })
      tx.set(settingsRef, { storeSlug: slug, updatedAt: now }, { merge: true })
    })

    return { slug }
  },
)
