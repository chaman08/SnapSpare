import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { onDocumentCreated } from 'firebase-functions/v2/firestore'

/**
 * Rolls up warranty claim counts onto the catalog part (design brief item 6:
 * "Track claim history per part number — it tells you which listings to
 * demote"). `warrantyClaimsCount` is all-time; `warrantyClaimsLast90d` is
 * the trailing window seller/admin dashboards should actually sort/filter
 * on — it's a simple increment-on-create counter (not decayed on a
 * schedule), which is an accepted approximation at this phase's scale; a
 * true rolling 90-day count would need a scheduled recompute, same
 * live-query-vs-rollup tradeoff already accepted elsewhere (see
 * computeSellerTrustScores.ts).
 */
export const onWarrantyClaimWrite = onDocumentCreated(
  { document: 'warrantyClaims/{claimId}', region: 'asia-south1' },
  async (event) => {
    const data = event.data?.data()
    const partId = data?.partId as string | undefined
    if (!partId) return

    await getFirestore()
      .collection('catalogParts')
      .doc(partId)
      .update({
        warrantyClaimsCount: FieldValue.increment(1),
        warrantyClaimsLast90d: FieldValue.increment(1),
        updatedAt: Date.now(),
      })
  },
)
