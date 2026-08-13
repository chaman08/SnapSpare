import { getFirestore } from 'firebase-admin/firestore'
import { onDocumentWritten } from 'firebase-functions/v2/firestore'
import { enqueueListingSync } from './searchIndexQueue.js'

/**
 * Any create/update/delete on a listing (price, stock, status, etc.) queues
 * it for a debounced re-sync to Typesense — see processSearchIndexQueue.ts
 * for the batch that actually talks to Typesense. Cheap and fire-and-forget:
 * this trigger never touches Typesense itself, so a search outage can't ever
 * fail a listing write.
 */
export const onListingWrite = onDocumentWritten(
  { document: 'listings/{listingId}', region: 'asia-south1' },
  async (event) => {
    const db = getFirestore()
    const batch = db.batch()
    enqueueListingSync(batch, db, event.params.listingId)
    await batch.commit()
  },
)
