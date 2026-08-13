import { sellerSchema } from '@snapspare/shared'
import { getAuth } from 'firebase-admin/auth'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import { onDocumentWritten } from 'firebase-functions/v2/firestore'

/**
 * Seller-onboarding approval hook: whenever a seller's status changes, keeps
 * the owner's custom claims (and denormalized Firestore role) in sync.
 * Approval (-> 'active') grants the seller claim + sellerId; any other
 * status change (suspended/deactivated/rejected) revokes it, falling back
 * to 'buyer' so a suspended seller doesn't lose app access entirely.
 */
export const onSellerStatusChange = onDocumentWritten(
  { document: 'sellers/{sellerId}', region: 'asia-south1' },
  async (event) => {
    const before = event.data?.before.exists ? event.data.before.data() : undefined
    const after = event.data?.after.exists ? event.data.after.data() : undefined
    if (!after) return // seller doc deleted — nothing to reconcile

    const sellerId = event.params.sellerId
    const parsed = sellerSchema.safeParse({ id: sellerId, ...after })
    if (!parsed.success) {
      logger.error('onSellerStatusChange: seller doc failed schema validation', {
        sellerId,
        issues: parsed.error.issues,
      })
      return
    }
    const seller = parsed.data

    if (before?.status === after.status) return // no status transition

    const ownerUserId = seller.ownerUserId
    const now = Date.now()

    if (seller.status === 'active') {
      await getAuth().setCustomUserClaims(ownerUserId, { role: 'seller', sellerId })
      await getFirestore().collection('users').doc(ownerUserId).update({
        roles: FieldValue.arrayUnion('seller'),
        primaryRole: 'seller',
        updatedAt: now,
      })
    } else {
      await getAuth().setCustomUserClaims(ownerUserId, { role: 'buyer' })
      await getFirestore().collection('users').doc(ownerUserId).update({
        primaryRole: 'buyer',
        updatedAt: now,
      })
    }
  },
)
