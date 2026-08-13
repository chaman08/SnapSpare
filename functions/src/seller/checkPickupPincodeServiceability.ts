import {
  type CheckPickupPincodeServiceabilityResult,
  checkPickupPincodeServiceabilityRequestSchema,
  pincodeMasterSchema,
} from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'

/**
 * Pickup-address serviceability for onboarding's Step 3 — distinct from
 * checkServiceability.ts (that one's buyer-checkout-shaped: per-*seller*
 * COD/ETA against a delivery pincode, and this applicant has no sellerId
 * yet). "Serviceable" here just means the pincode resolves in the same
 * `pincodes` master collection lookupPincode.ts already reads — a courier
 * can schedule a pickup anywhere in that list, matching the mock reality the
 * rest of this codebase's shipping stubs use.
 */
export const checkPickupPincodeServiceability = onCall(
  { enforceAppCheck: true, region: 'asia-south1' },
  async (request): Promise<CheckPickupPincodeServiceabilityResult> => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required')

    const parsed = checkPickupPincodeServiceabilityRequestSchema.safeParse(request.data)
    if (!parsed.success) throw new HttpsError('invalid-argument', 'A valid 6-digit pincode is required')
    const { pincode } = parsed.data

    const snapshot = await getFirestore().collection('pincodes').doc(pincode).get()
    if (!snapshot.exists) {
      return { pincode, serviceable: false }
    }

    const record = pincodeMasterSchema.parse({ id: snapshot.id, ...snapshot.data() })
    return { pincode, serviceable: true, city: record.city, state: record.state, stateCode: record.stateCode }
  },
)
