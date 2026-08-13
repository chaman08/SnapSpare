import { registerDeviceFingerprintRequestSchema } from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { enforceRateLimit } from '../util/rateLimit.js'

/** Past this many distinct accounts sharing one device fingerprint, every one of them is flagged for admin review — a household/shop sharing one browser profile is common enough that this stays a review signal, never an automatic block. */
const DUPLICATE_ACCOUNT_THRESHOLD = 3

/**
 * Registers (or refreshes) the calling account's device fingerprint against
 * `deviceFingerprints/{fingerprint}` (Phase 23: "duplicate account detection
 * by device fingerprint") — called once per sign-in from AuthProvider.tsx.
 * Past DUPLICATE_ACCOUNT_THRESHOLD distinct uids sharing one fingerprint,
 * every associated account is flagged `duplicateAccountFlag: true` for
 * admin review (same "flag, don't auto-enforce" convention as
 * orderVelocity.ts/returnAbuseFlag) — most often multi-accounting to farm
 * promo/referral credit or route around a codAbuseFlag block.
 */
export const registerDeviceFingerprint = onCall({ enforceAppCheck: true, region: 'asia-south1' }, async (request): Promise<{ ok: true }> => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required')
  const uid = request.auth.uid

  const parsed = registerDeviceFingerprintRequestSchema.safeParse(request.data)
  if (!parsed.success) throw new HttpsError('invalid-argument', 'A valid fingerprint is required')
  const { fingerprint } = parsed.data

  await enforceRateLimit(request, { name: 'registerDeviceFingerprint', perUidLimit: 20, perIpLimit: 60, windowMinutes: 60 })

  const db = getFirestore()
  const fingerprintRef = db.collection('deviceFingerprints').doc(fingerprint)
  const now = Date.now()

  const associatedUids = await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(fingerprintRef)
    const existingUids = (snapshot.exists ? (snapshot.data()?.uids as string[] | undefined) : undefined) ?? []
    const nextUids = existingUids.includes(uid) ? existingUids : [...existingUids, uid]

    tx.set(fingerprintRef, { uids: nextUids, updatedAt: now }, { merge: true })
    tx.update(db.collection('users').doc(uid), { deviceFingerprint: fingerprint, updatedAt: now })

    return nextUids
  })

  if (associatedUids.length >= DUPLICATE_ACCOUNT_THRESHOLD) {
    try {
      const batch = db.batch()
      for (const associatedUid of associatedUids) {
        batch.update(db.collection('users').doc(associatedUid), { duplicateAccountFlag: true, updatedAt: now })
      }
      await batch.commit()
    } catch (error) {
      // Best-effort: the fingerprint is already recorded either way, this
      // only decides whether the admin-review flag gets set this call.
      logger.error('registerDeviceFingerprint: failed to flag duplicate accounts', {
        fingerprint,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return { ok: true }
})
