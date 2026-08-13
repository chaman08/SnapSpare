import { FieldValue, type Firestore, type WriteBatch } from 'firebase-admin/firestore'

/**
 * Debounce window: rapid successive writes to the same listing (e.g. a
 * seller adjusting stock a few times in a row) collapse into a single
 * re-index instead of one Typesense write per Firestore write. Each enqueue
 * just pushes `dueAt` forward.
 */
const DEBOUNCE_MS = 15_000

export const SEARCH_INDEX_QUEUE_COLLECTION = 'searchIndexQueue'

/** Queues a listing for (re)sync, batched via a Firestore WriteBatch so a fan-out (e.g. from a catalogPart change) is one round trip per 500 listings. */
export function enqueueListingSync(batch: WriteBatch, db: Firestore, listingId: string): void {
  const ref = db.collection(SEARCH_INDEX_QUEUE_COLLECTION).doc(listingId)
  batch.set(
    ref,
    {
      listingId,
      dueAt: Date.now() + DEBOUNCE_MS,
      enqueuedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  )
}
