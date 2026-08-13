import { gstinSchema } from '@snapspare/shared'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { z } from 'zod'
import { enforceRateLimit } from '../util/rateLimit.js'

const requestSchema = z.object({ gstin: z.string() })

/**
 * Stub for real GSTIN verification (e.g. against the GST Council's public
 * search API or a KYC provider). For now it only re-validates the checksum
 * server-side and reports back — it does not persist a "verified" flag
 * anywhere. Swap the body for a real provider call in a later phase.
 */
export const verifyGstin = onCall({ enforceAppCheck: true, region: 'asia-south1' }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in required')
  }

  const parsed = requestSchema.safeParse(request.data)
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', 'gstin is required')
  }

  // A real provider call costs money per lookup — cap misuse now so swapping
  // in that provider later doesn't also require adding this.
  await enforceRateLimit(request, { name: 'verifyGstin', perUidLimit: 10, perIpLimit: 20, windowMinutes: 1440 })

  const gstinResult = gstinSchema.safeParse(parsed.data.gstin)
  if (!gstinResult.success) {
    return { status: 'invalid' as const }
  }

  return { status: 'pending' as const }
})
