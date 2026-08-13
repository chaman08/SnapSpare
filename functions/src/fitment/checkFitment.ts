import {
  type CatalogFitment,
  catalogFitmentSchema,
  checkFitmentRequestSchema,
  type CheckFitmentResult,
  type VehicleSelection,
} from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'

/**
 * make + model match is mandatory; variant/fuel/year only constrain the
 * match when the fitment row actually specifies them (see the comment on
 * catalogFitmentSchema in packages/shared).
 */
function matchesVehicle(fitment: CatalogFitment, vehicle: VehicleSelection): boolean {
  if (fitment.makeId !== vehicle.makeId || fitment.modelId !== vehicle.modelId) return false
  if (fitment.variantId && fitment.variantId !== vehicle.variantId) return false
  if (fitment.yearFrom !== undefined && vehicle.year < fitment.yearFrom) return false
  if (fitment.yearTo !== undefined && vehicle.year > fitment.yearTo) return false
  if (fitment.fuelTypes && fitment.fuelTypes.length > 0) {
    if (!vehicle.fuelType || !fitment.fuelTypes.includes(vehicle.fuelType)) return false
  }
  return true
}

/**
 * Public (no auth required — catalog browsing, including fitment badges, is
 * open to signed-out visitors, same as `catalogParts`/`listings` reads). A
 * callable rather than a direct client query so the matching algorithm lives
 * in one server-side place instead of being reimplemented (and trusted) in
 * the browser.
 *
 * Returns 'unverified' when the part has no fitment rows at all — we have no
 * data to confirm or deny compatibility, which is different from actively
 * knowing it doesn't fit.
 */
export const checkFitment = onCall({ enforceAppCheck: true, region: 'asia-south1' }, async (request): Promise<CheckFitmentResult> => {
  const parsed = checkFitmentRequestSchema.safeParse(request.data)
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', 'A valid partId and vehicle are required')
  }
  const { partId, vehicle } = parsed.data

  const snapshot = await getFirestore()
    .collection('catalogFitments')
    .where('partId', '==', partId)
    .get()

  if (snapshot.empty) {
    return { status: 'unverified' }
  }

  const fitments = snapshot.docs.map((doc) => catalogFitmentSchema.parse({ id: doc.id, ...doc.data() }))
  const match = fitments.find((fitment) => matchesVehicle(fitment, vehicle))

  return match ? { status: 'fits', fitment: match } : { status: 'does_not_fit' }
})
