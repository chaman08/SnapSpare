import {
  type VehicleRegLookupResult,
  vehicleMakeSchema,
  vehicleModelSchema,
  vehicleVariantSchema,
} from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import type { VehicleRegLookupProvider } from './regLookupProvider.js'

function hashString(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0
  }
  return hash
}

const NOT_FOUND: Omit<VehicleRegLookupResult, 'regNumber'> = {
  found: false,
  confidence: 'low',
  source: 'mock',
}

/**
 * **Development stand-in only.** No licensed vehicle-registration data
 * provider is integrated yet (candidates: Signzy, Karza, or a direct
 * VAHAN/NIC integration — each requires its own commercial agreement and
 * compliance review, since RTO registration data is regulated). This mock
 * deterministically derives a *plausible* vehicle from the plate string
 * using the app's own vehicle catalog, purely so the confirm/correct UI has
 * something real to render in dev/staging. It must be replaced before
 * production launch — see the `provider` wiring in lookupVehicleByReg.ts.
 */
export class MockVehicleRegLookupProvider implements VehicleRegLookupProvider {
  async lookup(regNumber: string): Promise<Omit<VehicleRegLookupResult, 'regNumber'>> {
    const hash = hashString(regNumber)

    // Simulate a real provider that doesn't always resolve a plate.
    if (hash % 5 === 0) return NOT_FOUND

    const db = getFirestore()

    const makesSnapshot = await db.collection('vehicleMakes').where('status', '==', 'active').get()
    if (makesSnapshot.empty) return NOT_FOUND
    const makes = makesSnapshot.docs.map((doc) => vehicleMakeSchema.parse({ id: doc.id, ...doc.data() }))
    const make = makes[hash % makes.length]
    if (!make) return NOT_FOUND

    const modelsSnapshot = await db
      .collection('vehicleModels')
      .where('makeId', '==', make.id)
      .where('status', '==', 'active')
      .get()
    if (modelsSnapshot.empty) return NOT_FOUND
    const models = modelsSnapshot.docs.map((doc) => vehicleModelSchema.parse({ id: doc.id, ...doc.data() }))
    const model = models[Math.floor(hash / 7) % models.length]
    if (!model) return NOT_FOUND

    const variantsSnapshot = await db
      .collection('vehicleVariants')
      .where('modelId', '==', model.id)
      .where('status', '==', 'active')
      .get()
    if (variantsSnapshot.empty) return NOT_FOUND
    const variants = variantsSnapshot.docs.map((doc) =>
      vehicleVariantSchema.parse({ id: doc.id, ...doc.data() }),
    )
    const variant = variants[Math.floor(hash / 13) % variants.length]
    if (!variant) return NOT_FOUND

    const currentYear = new Date().getFullYear()
    const yearSpan = (variant.yearTo ?? currentYear) - variant.yearFrom
    const year = variant.yearFrom + (yearSpan > 0 ? Math.floor(hash / 17) % (yearSpan + 1) : 0)

    return {
      found: true,
      makeId: make.id,
      makeName: make.name,
      modelId: model.id,
      modelName: model.name,
      variantId: variant.id,
      variantName: variant.name,
      year,
      fuelType: variant.fuelType,
      // Never 'high' — this is a hash-derived guess, not real registration data.
      confidence: 'medium',
      source: 'mock',
    }
  }
}
