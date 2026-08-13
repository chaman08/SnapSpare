import { idempotencyRecordSchema } from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError } from 'firebase-functions/v2/https'

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000

/**
 * Wraps a callable's side-effecting body so a retried request with the same
 * `key` (a client-generated UUID, stable across retries of one "Place
 * order"/"Confirm payment" click) never re-runs it — no double stock
 * reservation, no double Razorpay order, no double-charge. First caller to
 * claim the key runs `fn` and caches its JSON-serializable result; every
 * later caller with the same key gets that cached result back without
 * re-running anything. A caller that arrives while the first is still
 * mid-flight gets an `already-exists` error rather than racing it.
 *
 * Scoped by `functionName` so the same UUID can never collide across two
 * different callables (not that clients are expected to reuse one).
 */
export async function withIdempotency<T>(
  key: string,
  functionName: string,
  userId: string | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  const db = getFirestore()
  const ref = db.collection('idempotencyKeys').doc(key)

  const claim = await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref)
    if (snapshot.exists) {
      const record = idempotencyRecordSchema.parse({ id: snapshot.id, ...snapshot.data() })
      if (record.status === 'completed') {
        return { cachedJson: record.responseJson ?? 'null' }
      }
      throw new HttpsError('already-exists', 'This request is already being processed')
    }

    const now = Date.now()
    tx.set(ref, {
      functionName,
      userId,
      status: 'in_progress',
      createdAt: now,
      updatedAt: now,
      expiresAt: now + IDEMPOTENCY_TTL_MS,
    })
    return { cachedJson: undefined }
  })

  if (claim.cachedJson !== undefined) {
    return JSON.parse(claim.cachedJson) as T
  }

  try {
    const result = await fn()
    await ref.update({ status: 'completed', responseJson: JSON.stringify(result), updatedAt: Date.now() })
    return result
  } catch (error) {
    // Let a subsequent retry with the same key start clean instead of being
    // permanently stuck behind a failed attempt's 'in_progress' record.
    await ref.delete().catch(() => undefined)
    throw error
  }
}
