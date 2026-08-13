import { generateCatalogFitments } from '../data/fitments.js'
import { generateCatalogParts } from '../data/parts.js'
import { generateVehicles } from '../data/vehicles.js'
import { db } from '../lib/firebaseAdmin.js'
import { seedCollection } from '../lib/batch.js'

export async function seedCatalogAndVehicles(rng: () => number) {
  const { makes, models, variants, fitmentTargets } = generateVehicles()
  await seedCollection(db.collection('vehicleMakes'), makes)
  await seedCollection(db.collection('vehicleModels'), models)
  await seedCollection(db.collection('vehicleVariants'), variants)
  console.log(`  vehicleMakes: ${makes.length}, vehicleModels: ${models.length}, vehicleVariants: ${variants.length}`)

  const parts = generateCatalogParts(rng)
  await seedCollection(db.collection('catalogParts'), parts)
  console.log(`  catalogParts: ${parts.length}`)

  const fitments = generateCatalogFitments(rng, parts, fitmentTargets)
  await seedCollection(db.collection('catalogFitments'), fitments)
  console.log(`  catalogFitments: ${fitments.length}`)

  return { parts, fitmentTargets }
}
