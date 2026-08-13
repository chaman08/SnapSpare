import {
  buildSearchDocument,
  catalogPartSchema,
  listingSchema,
  SEARCH_COLLECTION_NAME,
  SEARCH_COLLECTION_SCHEMA,
  SEARCH_SYNONYM_SETS,
  sellerSchema,
  vehicleModelSchema,
  type SearchListingDocument,
} from '@snapspare/shared'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import Typesense from 'typesense'

/**
 * One-off / re-runnable initial index build: (re)creates the Typesense
 * collection + synonym set from the shared schema, then reads every active
 * listing (+ its catalog part + seller) straight from Firestore and bulk
 * imports them. Safe to re-run any time — it's a full upsert of current
 * state, not incremental (the ongoing incremental sync is
 * functions/src/search/processSearchIndexQueue.ts).
 *
 * Unlike the fake-data seeders in ../seeders (which refuse to run outside
 * the emulator), this script is meant to also run against a real project —
 * point it at one via GOOGLE_APPLICATION_CREDENTIALS / gcloud application
 * default credentials, or at the emulator via FIRESTORE_EMULATOR_HOST.
 *
 * Run with: pnpm --filter @snapspare/seed backfill-search
 */

const TYPESENSE_IMPORT_CHUNK = 500

// See the identical comment in functions/src/search/typesenseClient.ts —
// `Typesense.Client` only resolves as a type under some moduleResolution
// settings; `InstanceType<typeof Typesense.Client>` always works.
type TypesenseClient = InstanceType<typeof Typesense.Client>

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required to run the search backfill`)
  return value
}

async function ensureCollection(client: TypesenseClient): Promise<void> {
  try {
    await client.collections(SEARCH_COLLECTION_NAME).retrieve()
    console.log(`Collection "${SEARCH_COLLECTION_NAME}" already exists — reusing it.`)
  } catch {
    console.log(`Creating collection "${SEARCH_COLLECTION_NAME}"...`)
    // The typesense-js types model CollectionCreateSchema more narrowly than
    // our SDK-agnostic shared shape; both serialize to the same JSON body.
    await client.collections().create(SEARCH_COLLECTION_SCHEMA as never)
  }

  for (const set of SEARCH_SYNONYM_SETS) {
    await client.collections(SEARCH_COLLECTION_NAME).synonyms().upsert(set.id, { synonyms: set.synonyms })
  }
  console.log(`Upserted ${SEARCH_SYNONYM_SETS.length} synonym sets.`)
}

async function main() {
  const projectId = process.env.GCLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT ?? 'demo-snapspare'
  initializeApp({ projectId })
  const db = getFirestore()
  db.settings({ ignoreUndefinedProperties: true })

  const client = new Typesense.Client({
    nodes: [
      {
        host: process.env.TYPESENSE_HOST ?? 'localhost',
        port: Number(process.env.TYPESENSE_PORT ?? 8108),
        protocol: (process.env.TYPESENSE_PROTOCOL as 'http' | 'https' | undefined) ?? 'http',
      },
    ],
    apiKey: requiredEnv('TYPESENSE_ADMIN_API_KEY'),
    connectionTimeoutSeconds: 10,
  })

  await ensureCollection(client)

  console.log('Reading catalog parts...')
  const partSnapshots = await db.collection('catalogParts').where('status', '==', 'active').get()
  const parts = new Map(
    partSnapshots.docs
      .map((doc) => catalogPartSchema.safeParse({ id: doc.id, ...doc.data() }))
      .filter((r) => r.success)
      .map((r) => [r.data.id, r.data] as const),
  )
  console.log(`  ${parts.size} active parts`)

  console.log('Reading vehicle models (for the makeIds facet)...')
  const modelSnapshots = await db.collection('vehicleModels').get()
  const modelToMake = new Map<string, string>()
  for (const doc of modelSnapshots.docs) {
    const parsed = vehicleModelSchema.safeParse({ id: doc.id, ...doc.data() })
    if (parsed.success) modelToMake.set(parsed.data.id, parsed.data.makeId)
  }
  const resolveMakeId = (modelId: string) => modelToMake.get(modelId)

  console.log('Reading sellers...')
  const sellerSnapshots = await db.collection('sellers').get()
  const sellers = new Map(
    sellerSnapshots.docs
      .map((doc) => sellerSchema.safeParse({ id: doc.id, ...doc.data() }))
      .filter((r) => r.success)
      .map((r) => [r.data.id, r.data] as const),
  )
  console.log(`  ${sellers.size} sellers`)

  console.log('Reading active listings and building documents...')
  const listingSnapshots = await db.collection('listings').where('status', '==', 'active').get()

  const documents: SearchListingDocument[] = []
  for (const doc of listingSnapshots.docs) {
    const parsed = listingSchema.safeParse({ id: doc.id, ...doc.data() })
    if (!parsed.success) {
      console.warn(`  skipping listing ${doc.id}: failed schema validation`)
      continue
    }
    const listing = parsed.data
    const part = parts.get(listing.partId)
    if (!part) continue // inactive/missing part -> not searchable

    const seller = sellers.get(listing.sellerId)
    const searchDoc = buildSearchDocument({
      listing,
      part,
      sellerRatingAvg: seller?.ratingAvg ?? 0,
      sellerRatingCount: seller?.ratingCount ?? 0,
      sellerName: seller?.businessName ?? '',
      resolveMakeId,
    })
    if (searchDoc) documents.push(searchDoc)
  }
  console.log(`  built ${documents.length} search documents`)

  console.log('Importing into Typesense...')
  let imported = 0
  let failed = 0
  for (let i = 0; i < documents.length; i += TYPESENSE_IMPORT_CHUNK) {
    const chunk = documents.slice(i, i + TYPESENSE_IMPORT_CHUNK)
    const results = await client.collections(SEARCH_COLLECTION_NAME).documents().import(chunk, { action: 'upsert' })
    for (const result of results) {
      if (result.success) imported += 1
      else {
        failed += 1
        console.warn('  import failure:', result)
      }
    }
  }

  console.log(`\nDone. Imported ${imported} documents, ${failed} failures.`)
}

main().catch((error: unknown) => {
  console.error('Search backfill failed:', error)
  process.exitCode = 1
})
