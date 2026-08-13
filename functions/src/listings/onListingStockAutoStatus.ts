import { getFirestore } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import { onDocumentWritten } from 'firebase-functions/v2/firestore'

/**
 * Independent second trigger on `listings/{listingId}` alongside the
 * existing search-sync `onListingWrite.ts` — Firestore allows multiple
 * triggers per path, so this doesn't touch that file. Flips `active ⇄
 * out_of_stock` purely off `stockQty` crossing zero; never touches
 * `draft`/`paused`/`rejected`/`archived` — a seller-chosen pause (or an
 * as-yet-unpublished draft) must stay exactly as the seller left it
 * regardless of stock level. Self-terminates: the write this function makes
 * re-fires the trigger, but by then status already matches, so the
 * condition is false and nothing happens on the second pass.
 */
export const onListingStockAutoStatus = onDocumentWritten(
  { document: 'listings/{listingId}', region: 'asia-south1' },
  async (event) => {
    const after = event.data?.after.exists ? event.data.after.data() : undefined
    if (!after) return

    const status = after.status as string
    const stockQty = after.stockQty as number

    let nextStatus: 'active' | 'out_of_stock' | undefined
    if (status === 'active' && stockQty <= 0) nextStatus = 'out_of_stock'
    else if (status === 'out_of_stock' && stockQty > 0) nextStatus = 'active'
    if (!nextStatus) return

    const listingId = event.params.listingId as string
    try {
      await getFirestore().collection('listings').doc(listingId).update({
        status: nextStatus,
        updatedAt: Date.now(),
      })
    } catch (error) {
      logger.error('onListingStockAutoStatus: failed', {
        listingId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  },
)
