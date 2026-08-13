import { FieldValue, type Firestore, type WriteBatch } from 'firebase-admin/firestore'

/** Same debounce rationale as searchIndexQueue.ts's DEBOUNCE_MS. */
const DEBOUNCE_MS = 15_000

export const CATALOG_PART_SEARCH_INDEX_QUEUE_COLLECTION = 'catalogPartSearchIndexQueue'

/** Queues a catalog part for (re)sync into the `catalog_parts` Typesense collection — structurally identical to searchIndexQueue.ts's enqueueListingSync, kept as a separate function since it's a separate queue collection with a separate drain schedule. */
export function enqueueCatalogPartSearchSync(batch: WriteBatch, db: Firestore, partId: string): void {
  const ref = db.collection(CATALOG_PART_SEARCH_INDEX_QUEUE_COLLECTION).doc(partId)
  batch.set(
    ref,
    {
      partId,
      dueAt: Date.now() + DEBOUNCE_MS,
      enqueuedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  )
}
