import { type SetHolidayModeResult, setHolidayModeRequestSchema } from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { requireSellerPermission } from './staffAuthz.js'

const BATCH_LIMIT = 400

/**
 * manage_listings-gated. Turning holiday mode on pauses every currently
 * `active` listing and marks it `pausedByHolidayMode: true`; turning it off
 * only resumes listings still carrying that marker, so a listing the seller
 * had separately paused (out of stock, discontinued, etc.) stays paused.
 * This is why holidayMode can't be a plain rules-guarded field on the
 * settings doc like storeName/SLA prefs are — it has to fan out to
 * potentially hundreds of listing docs atomically per batch.
 */
export const setHolidayMode = onCall({ enforceAppCheck: true, region: 'asia-south1' }, async (request): Promise<SetHolidayModeResult> => {
  const sellerId = requireSellerPermission(request, 'manage_listings')

  const parsed = setHolidayModeRequestSchema.safeParse(request.data)
  if (!parsed.success) throw new HttpsError('invalid-argument', 'Invalid request')
  const input = parsed.data

  const db = getFirestore()
  const now = Date.now()
  const listingsRef = db.collection('listings')

  let listingsAffected = 0

  if (input.active) {
    const toPause = await listingsRef.where('sellerId', '==', sellerId).where('status', '==', 'active').get()
    for (let i = 0; i < toPause.docs.length; i += BATCH_LIMIT) {
      const batch = db.batch()
      for (const doc of toPause.docs.slice(i, i + BATCH_LIMIT)) {
        batch.update(doc.ref, { status: 'paused', pausedByHolidayMode: true, updatedAt: now })
      }
      await batch.commit()
    }
    listingsAffected = toPause.size
  } else {
    const toResume = await listingsRef
      .where('sellerId', '==', sellerId)
      .where('pausedByHolidayMode', '==', true)
      .get()
    for (let i = 0; i < toResume.docs.length; i += BATCH_LIMIT) {
      const batch = db.batch()
      for (const doc of toResume.docs.slice(i, i + BATCH_LIMIT)) {
        batch.update(doc.ref, { status: 'active', pausedByHolidayMode: false, updatedAt: now })
      }
      await batch.commit()
    }
    listingsAffected = toResume.size
  }

  await db
    .collection('sellers')
    .doc(sellerId)
    .collection('settings')
    .doc('general')
    .set(
      {
        holidayMode: {
          active: input.active,
          ...(input.returnDate !== undefined ? { returnDate: input.returnDate } : {}),
          ...(input.reason !== undefined ? { reason: input.reason } : {}),
          setAt: now,
        },
        updatedAt: now,
      },
      { merge: true },
    )

  return { listingsAffected }
})
