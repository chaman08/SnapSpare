import { pincodeMasterSchema, pincodeSchema } from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { z } from 'zod'

const requestSchema = z.object({ pincode: pincodeSchema })

/**
 * Looks up city/state for a pincode from the `pincodes` master collection,
 * for the address book's auto-fill. Callable (not a plain read) so we can
 * validate the pincode format server-side and keep the master collection
 * itself locked down in security rules.
 */
export const lookupPincode = onCall({ enforceAppCheck: true, region: 'asia-south1' }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in required')
  }

  const parsed = requestSchema.safeParse(request.data)
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', 'Pincode must be 6 digits')
  }

  const snapshot = await getFirestore().collection('pincodes').doc(parsed.data.pincode).get()
  if (!snapshot.exists) {
    throw new HttpsError('not-found', 'No matching pincode found')
  }

  const record = pincodeMasterSchema.parse({ id: snapshot.id, ...snapshot.data() })
  return { city: record.city, state: record.state, stateCode: record.stateCode }
})
