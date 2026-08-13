import type { CollectionReference } from 'firebase-admin/firestore'
import { db } from './firebaseAdmin.js'

const BATCH_SIZE = 400 // Firestore's hard limit is 500 writes per batch

/**
 * Writes `{ id, ...data }` records to `collection` in chunks of
 * BATCH_SIZE, well under Firestore's 500-writes-per-batch limit.
 */
export async function seedCollection<T extends { id: string }>(
  collection: CollectionReference,
  records: T[],
): Promise<void> {
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const chunk = records.slice(i, i + BATCH_SIZE)
    const batch = db.batch()
    for (const record of chunk) {
      const { id, ...data } = record
      batch.set(collection.doc(id), data)
    }
    await batch.commit()
  }
}
