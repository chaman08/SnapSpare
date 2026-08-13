import { subOrderSchema } from '@snapspare/shared'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import { onDocumentUpdated } from 'firebase-functions/v2/firestore'

/**
 * Fires once per subOrder, exactly when its status transitions *into*
 * 'delivered'. Does two independent things off the back of that single
 * event, both documented elsewhere as depending on it:
 *
 * 1. Writes a `reviewEligibility/{buyerId}_{listingId}` gate doc per line
 *    item (see firestore.rules' reviews section and
 *    schemas/reviewEligibility.ts — both already assume this function
 *    exists) so the buyer can leave a verified-purchase review.
 * 2. Increments pairwise `coOccurrence/{partId}.boughtWith` counts across
 *    every distinct part in the subOrder — the data source for
 *    "Frequently bought together" on the product detail page.
 *
 * Part/listing/seller ids are plain hyphenated strings throughout this
 * codebase (see ids.ts's doc comment), never containing '.', so using them
 * as Firestore dot-path map keys below is safe.
 */
export const onSubOrderDelivered = onDocumentUpdated(
  { document: 'subOrders/{subOrderId}', region: 'asia-south1' },
  async (event) => {
    const beforeStatus = event.data?.before.data()?.status
    const afterData = event.data?.after.data()
    if (!afterData || afterData.status !== 'delivered' || beforeStatus === 'delivered') return

    const parsed = subOrderSchema.safeParse({ id: event.params.subOrderId, ...afterData })
    if (!parsed.success) {
      logger.error('onSubOrderDelivered: subOrder failed schema validation', {
        subOrderId: event.params.subOrderId,
        issues: parsed.error.issues,
      })
      return
    }
    const subOrder = parsed.data
    const db = getFirestore()
    const now = Date.now()
    const batch = db.batch()

    for (const item of subOrder.items) {
      const eligibilityId = `${subOrder.buyerId}_${item.listingId}`
      batch.set(db.collection('reviewEligibility').doc(eligibilityId), {
        id: eligibilityId,
        buyerId: subOrder.buyerId,
        listingId: item.listingId,
        orderId: subOrder.orderId,
        subOrderId: subOrder.id,
        eligible: true,
        createdAt: now,
      })
    }

    const partIds = Array.from(new Set(subOrder.items.map((item) => item.partId)))
    for (const partId of partIds) {
      const others = partIds.filter((id) => id !== partId)
      if (others.length === 0) continue

      const update: Record<string, unknown> = { id: partId, updatedAt: now }
      for (const otherId of others) {
        update[`boughtWith.${otherId}`] = FieldValue.increment(1)
      }
      batch.set(db.collection('coOccurrence').doc(partId), update, { merge: true })
    }

    await batch.commit()
  },
)
