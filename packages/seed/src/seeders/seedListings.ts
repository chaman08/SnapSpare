import type { CatalogPart, Listing } from '@snapspare/shared'
import { generateListings } from '../data/listings.js'
import { SELLER_BLUEPRINTS } from '../data/sellers.js'
import { seedCollection } from '../lib/batch.js'
import { db } from '../lib/firebaseAdmin.js'

export async function seedListings(rng: () => number, parts: CatalogPart[]): Promise<Listing[]> {
  const listings = generateListings(rng, parts, SELLER_BLUEPRINTS)
  await seedCollection(db.collection('listings'), listings)
  console.log(`  listings: ${listings.length}`)
  return listings
}
