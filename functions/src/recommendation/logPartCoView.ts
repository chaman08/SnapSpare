import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { onCall } from 'firebase-functions/v2/https'
import { z } from 'zod'

const logPartCoViewRequestSchema = z.object({
  partId: z.string().min(1),
  previousPartId: z.string().min(1).optional(),
})

/**
 * Fire-and-forget signal from ProductDetailPage: "this visitor viewed
 * partId right after previousPartId" (see the client's session-scoped
 * last-viewed tracking in features/catalog/api/useRelatedParts.ts).
 * Increments coOccurrence.viewedWith pairwise — the "Others also viewed"
 * counterpart to onSubOrderDelivered's boughtWith. Public like every other
 * catalog-browsing read (checkFitment, lookupPincode) — App Check is the
 * abuse gate, not auth. Silently no-ops when there's no previous part (a
 * fresh session) or it matches the current one (a refresh), rather than
 * erroring on what's a normal, expected client state.
 */
export const logPartCoView = onCall({ enforceAppCheck: true, region: 'asia-south1' }, async (request) => {
  const parsed = logPartCoViewRequestSchema.safeParse(request.data)
  if (!parsed.success) return { ok: false }

  const { partId, previousPartId } = parsed.data
  if (!previousPartId || previousPartId === partId) return { ok: true }

  const db = getFirestore()
  const now = Date.now()
  const batch = db.batch()

  batch.set(
    db.collection('coOccurrence').doc(partId),
    { id: partId, updatedAt: now, [`viewedWith.${previousPartId}`]: FieldValue.increment(1) },
    { merge: true },
  )
  batch.set(
    db.collection('coOccurrence').doc(previousPartId),
    { id: previousPartId, updatedAt: now, [`viewedWith.${partId}`]: FieldValue.increment(1) },
    { merge: true },
  )

  await batch.commit()
  return { ok: true }
})
