import { lookupVehicleByRegRequestSchema, type VehicleRegLookupResult } from '@snapspare/shared'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { MockVehicleRegLookupProvider } from './mockRegLookupProvider.js'
import type { VehicleRegLookupProvider } from './regLookupProvider.js'

const RATE_LIMIT_PER_DAY = 10

// Swap for a real licensed provider before production launch — see the
// module comment on MockVehicleRegLookupProvider for why this is a mock.
const provider: VehicleRegLookupProvider = new MockVehicleRegLookupProvider()

function todayKey(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '')
}

/**
 * Caps lookups at RATE_LIMIT_PER_DAY per signed-in user per UTC day. Backed
 * by a `rateLimits` doc that's closed to direct client read/write in
 * firestore.rules — only this Cloud Function (Admin SDK) ever touches it.
 * A transaction avoids a check-then-increment race if a user double-taps
 * the lookup button.
 */
async function checkAndIncrementRateLimit(uid: string): Promise<void> {
  const db = getFirestore()
  const rateLimitRef = db.collection('rateLimits').doc(`${uid}_lookupVehicleByReg_${todayKey()}`)

  await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(rateLimitRef)
    const count = snapshot.exists ? ((snapshot.data()?.count as number | undefined) ?? 0) : 0

    if (count >= RATE_LIMIT_PER_DAY) {
      throw new HttpsError(
        'resource-exhausted',
        'Daily registration lookup limit reached. Please try again tomorrow.',
      )
    }

    tx.set(rateLimitRef, { count: count + 1, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
  })
}

/**
 * Resolves a vehicle registration number to a make/model/variant/year guess
 * so a buyer can confirm (or correct) it instead of working through the full
 * cascading VehicleSelector. Requires sign-in (unlike checkFitment) because
 * it's rate-limited and, in production, would call a paid data provider —
 * see regLookupProvider.ts / mockRegLookupProvider.ts.
 */
export const lookupVehicleByReg = onCall(
  { enforceAppCheck: true, region: 'asia-south1' },
  async (request): Promise<VehicleRegLookupResult> => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign in required')
    }

    const parsed = lookupVehicleByRegRequestSchema.safeParse(request.data)
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', 'A valid vehicle registration number is required')
    }

    await checkAndIncrementRateLimit(request.auth.uid)

    const result = await provider.lookup(parsed.data.regNumber)
    return { regNumber: parsed.data.regNumber, ...result }
  },
)
