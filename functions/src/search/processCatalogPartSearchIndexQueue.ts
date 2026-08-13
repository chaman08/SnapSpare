import {
  buildCatalogPartSearchDocument,
  CATALOG_PART_SEARCH_COLLECTION_NAME,
  catalogPartSchema,
  type SearchCatalogPartDocument,
} from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { CATALOG_PART_SEARCH_INDEX_QUEUE_COLLECTION } from './catalogPartSearchQueue.js'
import { getTypesenseAdminClient, typesenseAdminApiKey } from './typesenseClient.js'

const BATCH_LIMIT = 250
const FIRESTORE_BATCH_CHUNK = 500

/**
 * Drains `catalogPartSearchIndexQueue` every minute — structurally the same
 * batched/debounced shape as `processSearchIndexQueue.ts`, but a separate
 * function against a separate queue/collection since it syncs `catalogParts`
 * directly rather than denormalizing part fields onto listings.
 */
export const processCatalogPartSearchIndexQueue = onSchedule(
  { schedule: 'every 1 minutes', region: 'asia-south1', secrets: [typesenseAdminApiKey] },
  async () => {
    const db = getFirestore()
    const now = Date.now()

    const queueSnapshot = await db
      .collection(CATALOG_PART_SEARCH_INDEX_QUEUE_COLLECTION)
      .where('dueAt', '<=', now)
      .orderBy('dueAt')
      .limit(BATCH_LIMIT)
      .get()

    if (queueSnapshot.empty) return

    const partIds = queueSnapshot.docs.map((doc) => doc.id)
    const partSnapshots = await db.getAll(...partIds.map((id) => db.collection('catalogParts').doc(id)))

    const upserts: SearchCatalogPartDocument[] = []
    const deleteIds: string[] = []

    for (const snapshot of partSnapshots) {
      if (!snapshot.exists) {
        deleteIds.push(snapshot.id)
        continue
      }
      const parsed = catalogPartSchema.safeParse({ id: snapshot.id, ...snapshot.data() })
      if (!parsed.success) {
        logger.error('processCatalogPartSearchIndexQueue: part failed schema validation, removing from index', {
          partId: snapshot.id,
          issues: parsed.error.issues,
        })
        deleteIds.push(snapshot.id)
        continue
      }
      const doc = buildCatalogPartSearchDocument(parsed.data)
      if (doc) upserts.push(doc)
      else deleteIds.push(snapshot.id)
    }

    const client = getTypesenseAdminClient()

    if (upserts.length > 0) {
      const results = await client
        .collections(CATALOG_PART_SEARCH_COLLECTION_NAME)
        .documents()
        .import(upserts, { action: 'upsert' })
      const failures = results.filter((r) => !r.success)
      if (failures.length > 0) {
        logger.error('processCatalogPartSearchIndexQueue: some documents failed to upsert', { failures })
      }
    }

    if (deleteIds.length > 0) {
      await Promise.all(
        deleteIds.map(async (id) => {
          try {
            await client.collections(CATALOG_PART_SEARCH_COLLECTION_NAME).documents(id).delete()
          } catch (error) {
            const httpStatus = (error as { httpStatus?: number }).httpStatus
            if (httpStatus !== 404) {
              logger.error('processCatalogPartSearchIndexQueue: failed to delete document', { id, error })
            }
          }
        }),
      )
    }

    for (let i = 0; i < partIds.length; i += FIRESTORE_BATCH_CHUNK) {
      const chunk = partIds.slice(i, i + FIRESTORE_BATCH_CHUNK)
      const batch = db.batch()
      for (const id of chunk) batch.delete(db.collection(CATALOG_PART_SEARCH_INDEX_QUEUE_COLLECTION).doc(id))
      await batch.commit()
    }

    logger.info('processCatalogPartSearchIndexQueue: batch complete', {
      processed: partIds.length,
      upserted: upserts.length,
      deleted: deleteIds.length,
    })
  },
)
