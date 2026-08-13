import { getFirestore } from 'firebase-admin/firestore'
import { onDocumentWritten } from 'firebase-functions/v2/firestore'
import { enqueueCatalogPartSearchSync } from './catalogPartSearchQueue.js'

/**
 * Independent second trigger on `catalogParts/{partId}`, alongside the
 * existing `onCatalogPartWrite.ts` (which fans out to affected *listings*
 * for the buyer-facing `listings` search collection). This one only
 * enqueues the part itself into the separate `catalog_parts` queue — see
 * catalogPartSearchCollectionSchema.ts's header comment for why the two
 * pipelines stay independent. Firestore allows multiple triggers per path,
 * so this doesn't touch onCatalogPartWrite.ts.
 */
export const onCatalogPartWriteSearch = onDocumentWritten(
  { document: 'catalogParts/{partId}', region: 'asia-south1' },
  async (event) => {
    const db = getFirestore()
    const partId = event.params.partId as string
    const batch = db.batch()
    enqueueCatalogPartSearchSync(batch, db, partId)
    await batch.commit()
  },
)
