import './lib/firebaseAdmin.js' // side-effect: throws if not pointed at an emulator
import { createRng } from './lib/random.js'
import { seedAdmin } from './seeders/seedAdmin.js'
import { seedBuyers } from './seeders/seedBuyers.js'
import { seedCatalogAndVehicles } from './seeders/seedCatalogAndVehicles.js'
import { seedConfig } from './seeders/seedConfig.js'
import { seedCoupons } from './seeders/seedCoupons.js'
import { seedLegalContent } from './seeders/seedLegalContent.js'
import { seedListings } from './seeders/seedListings.js'
import { seedOrders } from './seeders/seedOrders.js'
import { seedPincodes } from './seeders/seedPincodes.js'
import { seedQa } from './seeders/seedQa.js'
import { seedReviews } from './seeders/seedReviews.js'
import { seedSellers } from './seeders/seedSellers.js'

const SEED = 20260101 // fixed seed -> identical dataset on every `pnpm seed` run

async function main() {
  const rng = createRng(SEED)
  const startedAt = Date.now()

  console.log('Seeding config...')
  await seedConfig()

  console.log('Seeding admin...')
  await seedAdmin()

  console.log('Seeding vehicles + catalog...')
  const { parts } = await seedCatalogAndVehicles(rng)

  console.log('Seeding sellers...')
  await seedSellers(rng)

  console.log('Seeding buyers...')
  await seedBuyers()

  console.log('Seeding listings...')
  const listings = await seedListings(rng, parts)

  console.log('Seeding pincode master...')
  await seedPincodes()

  console.log('Seeding legal pages + help centre articles...')
  await seedLegalContent()

  console.log('Seeding orders...')
  const deliveredPurchases = await seedOrders(rng, listings)

  console.log('Seeding reviews...')
  await seedReviews(rng, deliveredPurchases)

  console.log('Seeding Q&A...')
  await seedQa(rng, parts)

  console.log('Seeding coupons...')
  await seedCoupons()

  const elapsedSeconds = ((Date.now() - startedAt) / 1000).toFixed(1)
  console.log(`\nDone in ${elapsedSeconds}s.`)
}

main().catch((error: unknown) => {
  console.error('Seed script failed:', error)
  process.exitCode = 1
})
