import {
  buildSearchDocument,
  catalogPartSchema,
  listingSchema,
  SEARCH_COLLECTION_NAME,
  sellerSchema,
  type SearchListingDocument,
} from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { buildModelMakeResolver } from './modelMakeResolver.js'
import { SEARCH_INDEX_QUEUE_COLLECTION } from './searchIndexQueue.js'
import { getTypesenseAdminClient, typesenseAdminApiKey } from './typesenseClient.js'

const BATCH_LIMIT = 250
const FIRESTORE_BATCH_CHUNK = 500

/**
 * Drains `searchIndexQueue` (populated by onListingWrite/onCatalogPartWrite)
 * every minute: batch-fetches each due listing + its part + seller, builds
 * the Typesense document (or decides the listing should be removed from the
 * index), and pushes everything as one bulk `import` upsert plus a handful
 * of deletes, rather than one Typesense API call per changed document. This
 * is the "batched and debounced" sync the trigger functions defer to.
 */
export const processSearchIndexQueue = onSchedule(
  { schedule: 'every 1 minutes', region: 'asia-south1', secrets: [typesenseAdminApiKey] },
  async () => {
    const db = getFirestore()
    const now = Date.now()

    const queueSnapshot = await db
      .collection(SEARCH_INDEX_QUEUE_COLLECTION)
      .where('dueAt', '<=', now)
      .orderBy('dueAt')
      .limit(BATCH_LIMIT)
      .get()

    if (queueSnapshot.empty) return

    const listingIds = queueSnapshot.docs.map((doc) => doc.id)

    const listingSnapshots = await db.getAll(
      ...listingIds.map((id) => db.collection('listings').doc(id)),
    )

    const listings = new Map<string, ReturnType<typeof listingSchema.parse>>()
    const missingListingIds: string[] = []

    for (const snapshot of listingSnapshots) {
      if (!snapshot.exists) {
        missingListingIds.push(snapshot.id)
        continue
      }
      const parsed = listingSchema.safeParse({ id: snapshot.id, ...snapshot.data() })
      if (!parsed.success) {
        logger.error('processSearchIndexQueue: listing failed schema validation, removing from index', {
          listingId: snapshot.id,
          issues: parsed.error.issues,
        })
        missingListingIds.push(snapshot.id)
        continue
      }
      listings.set(snapshot.id, parsed.data)
    }

    const partIds = Array.from(new Set(Array.from(listings.values()).map((l) => l.partId)))
    const partSnapshots = await db.getAll(...partIds.map((id) => db.collection('catalogParts').doc(id)))
    const parts = new Map<string, ReturnType<typeof catalogPartSchema.parse>>()
    for (const snapshot of partSnapshots) {
      if (!snapshot.exists) continue
      const parsed = catalogPartSchema.safeParse({ id: snapshot.id, ...snapshot.data() })
      if (parsed.success) parts.set(snapshot.id, parsed.data)
    }

    const sellerIds = Array.from(new Set(Array.from(listings.values()).map((l) => l.sellerId)))
    const sellerSnapshots = await db.getAll(...sellerIds.map((id) => db.collection('sellers').doc(id)))
    const sellers = new Map<string, ReturnType<typeof sellerSchema.parse>>()
    for (const snapshot of sellerSnapshots) {
      if (!snapshot.exists) continue
      const parsed = sellerSchema.safeParse({ id: snapshot.id, ...snapshot.data() })
      if (parsed.success) sellers.set(snapshot.id, parsed.data)
    }

    const allModelIds = Array.from(parts.values()).flatMap((part) => part.fitmentSummary.modelIds)
    const resolveMakeId = await buildModelMakeResolver(db, allModelIds)

    const upserts: SearchListingDocument[] = []
    const deleteIds: string[] = [...missingListingIds]

    for (const [listingId, listing] of listings) {
      const part = parts.get(listing.partId)
      if (!part) {
        deleteIds.push(listingId)
        continue
      }
      const seller = sellers.get(listing.sellerId)
      const doc = buildSearchDocument({
        listing,
        part,
        sellerRatingAvg: seller?.ratingAvg ?? 0,
        sellerRatingCount: seller?.ratingCount ?? 0,
        sellerName: seller?.businessName ?? '',
        resolveMakeId,
      })
      if (doc) {
        upserts.push(doc)
      } else {
        deleteIds.push(listingId)
      }
    }

    const client = getTypesenseAdminClient()

    if (upserts.length > 0) {
      const results = await client
        .collections(SEARCH_COLLECTION_NAME)
        .documents()
        .import(upserts, { action: 'upsert' })
      const failures = results.filter((r) => !r.success)
      if (failures.length > 0) {
        logger.error('processSearchIndexQueue: some documents failed to upsert', { failures })
      }
    }

    if (deleteIds.length > 0) {
      await Promise.all(
        deleteIds.map(async (id) => {
          try {
            await client.collections(SEARCH_COLLECTION_NAME).documents(id).delete()
          } catch (error) {
            const httpStatus = (error as { httpStatus?: number }).httpStatus
            if (httpStatus !== 404) {
              logger.error('processSearchIndexQueue: failed to delete document', { id, error })
            }
          }
        }),
      )
    }

    for (let i = 0; i < listingIds.length; i += FIRESTORE_BATCH_CHUNK) {
      const chunk = listingIds.slice(i, i + FIRESTORE_BATCH_CHUNK)
      const batch = db.batch()
      for (const id of chunk) batch.delete(db.collection(SEARCH_INDEX_QUEUE_COLLECTION).doc(id))
      await batch.commit()
    }

    logger.info('processSearchIndexQueue: batch complete', {
      processed: listingIds.length,
      upserted: upserts.length,
      deleted: deleteIds.length,
    })
  },
)
