import {
  buildCatalogPartSearchDocument,
  CATALOG_PART_SEARCH_COLLECTION_NAME,
  CATALOG_PART_SEARCH_COLLECTION_SCHEMA,
  catalogPartSchema,
  type SearchCatalogPartDocument,
} from '@snapspare/shared'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import Typesense from 'typesense'

/**
 * Provisions the `catalog_parts` Typesense collection (Phase 14's
 * seller-facing "Add listing" typeahead — see
 * catalogPartSearchCollectionSchema.ts) and backfills it from every
 * catalogPart in Firestore. Same shape and re-run safety as
 * backfillSearchIndex.ts, kept as a separate script since it indexes a
 * different source collection into a different Typesense collection.
 *
 * Run with: pnpm --filter @snapspare/seed backfill-catalog-part-search
 */

const TYPESENSE_IMPORT_CHUNK = 500

type TypesenseClient = InstanceType<typeof Typesense.Client>

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required to run the catalog part search backfill`)
  return value
}

async function ensureCollection(client: TypesenseClient): Promise<void> {
  try {
    await client.collections(CATALOG_PART_SEARCH_COLLECTION_NAME).retrieve()
    console.log(`Collection "${CATALOG_PART_SEARCH_COLLECTION_NAME}" already exists — reusing it.`)
  } catch {
    console.log(`Creating collection "${CATALOG_PART_SEARCH_COLLECTION_NAME}"...`)
    await client.collections().create(CATALOG_PART_SEARCH_COLLECTION_SCHEMA as never)
  }
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
  const partSnapshots = await db.collection('catalogParts').get()

  const documents: SearchCatalogPartDocument[] = []
  for (const doc of partSnapshots.docs) {
    const parsed = catalogPartSchema.safeParse({ id: doc.id, ...doc.data() })
    if (!parsed.success) {
      console.warn(`  skipping part ${doc.id}: failed schema validation`)
      continue
    }
    const searchDoc = buildCatalogPartSearchDocument(parsed.data)
    if (searchDoc) documents.push(searchDoc)
  }
  console.log(`  built ${documents.length} search documents`)

  console.log('Importing into Typesense...')
  let imported = 0
  let failed = 0
  for (let i = 0; i < documents.length; i += TYPESENSE_IMPORT_CHUNK) {
    const chunk = documents.slice(i, i + TYPESENSE_IMPORT_CHUNK)
    const results = await client
      .collections(CATALOG_PART_SEARCH_COLLECTION_NAME)
      .documents()
      .import(chunk, { action: 'upsert' })
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
  console.error('Catalog part search backfill failed:', error)
  process.exitCode = 1
})
