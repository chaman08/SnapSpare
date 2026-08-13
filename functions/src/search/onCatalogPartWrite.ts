import { getFirestore } from 'firebase-admin/firestore'
import { onDocumentWritten } from 'firebase-functions/v2/firestore'
import { enqueueListingSync } from './searchIndexQueue.js'

const LISTING_QUERY_CHUNK = 500

/**
 * A catalogPart change (brand, oemNumbers, category, fitmentSummary, status
 * going inactive, ...) affects every listing built on it, since a search
 * document denormalizes those part-level fields onto each listing's own
 * document. Re-enqueues every listing for the part rather than trying to
 * diff which fields actually changed — cheap (a single indexed `where`
 * query) and simpler than tracking per-field deltas.
 */
export const onCatalogPartWrite = onDocumentWritten(
  { document: 'catalogParts/{partId}', region: 'asia-south1' },
  async (event) => {
    const db = getFirestore()
    const partId = event.params.partId

    const snapshot = await db.collection('listings').where('partId', '==', partId).select().get()
    if (snapshot.empty) return

    const listingIds = snapshot.docs.map((doc) => doc.id)
    for (let i = 0; i < listingIds.length; i += LISTING_QUERY_CHUNK) {
      const chunk = listingIds.slice(i, i + LISTING_QUERY_CHUNK)
      const batch = db.batch()
      for (const listingId of chunk) enqueueListingSync(batch, db, listingId)
      await batch.commit()
    }
  },
)
