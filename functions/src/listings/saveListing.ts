import { type SaveListingResult, saveListingRequestSchema } from '@snapspare/shared'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { requireSellerPermission } from '../seller/staffAuthz.js'
import { persistListing } from './persistListing.js'

/**
 * manage_listings-gated create/update for a single listing. `request.data.id`
 * absent means create; present means update (ownership + partId/sellerId
 * immutability enforced inside `persistListing.ts`, the single writer this
 * and every other listing-authoring path shares).
 */
export const saveListing = onCall({ enforceAppCheck: true, region: 'asia-south1' }, async (request): Promise<SaveListingResult> => {
  const sellerId = requireSellerPermission(request, 'manage_listings')

  const parsed = saveListingRequestSchema.safeParse(request.data)
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', parsed.error.issues[0]?.message ?? 'invalid_request', {
      issues: parsed.error.issues,
    })
  }

  return persistListing({ sellerId, input: parsed.data })
})
