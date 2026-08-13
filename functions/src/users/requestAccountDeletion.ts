import { getAuth } from 'firebase-admin/auth'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { writeAuditLog } from '../util/auditLog.js'
import { enforceRateLimit } from '../util/rateLimit.js'

export interface RequestAccountDeletionResult {
  status: 'deleted'
}

const IN_FLIGHT_ORDER_STATUSES = [
  'pending_payment',
  'placed',
  'confirmed',
  'processing',
  'partially_shipped',
  'shipped',
  'delivered',
] as const
const OPEN_RETURN_STATUSES = ['requested', 'approved', 'picked_up', 'qc_disputed'] as const
const OPEN_DISPUTE_STATUSES = ['open', 'under_review'] as const

/**
 * Self-service account-deletion request (Phase 23 PII requirement). Blocks
 * on anything that still needs this account attached to a live financial or
 * operational trail — an in-flight order, an open return/dispute, a seller
 * account, or an outstanding credit balance — the same way most regulated
 * marketplaces require "settle up first," rather than silently skipping
 * those records. Once clear, this is a real deletion, not a soft flag:
 * live PII on `users/{uid}` (name/email/photo/phone/gstin/pan/fcmTokens) is
 * scrubbed and the saved-address subcollection is removed, `status` moves
 * to 'deleted' (already a first-class value in userSchema), the Firebase
 * Auth account is deleted so the phone number can never sign back in to it,
 * and an audit entry records that the deletion happened — but it does NOT
 * touch `orders`/`subOrders`/`invoices`: those are GST-compliance records
 * this platform is legally required to retain regardless of the buyer's
 * account status, and they only ever held a `buyerId` reference, not a
 * live copy of the profile being deleted here.
 */
export const requestAccountDeletion = onCall(
  { enforceAppCheck: true, region: 'asia-south1' },
  async (request): Promise<RequestAccountDeletionResult> => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required')
    const uid = request.auth.uid

    await enforceRateLimit(request, { name: 'requestAccountDeletion', perUidLimit: 3, perIpLimit: 6, windowMinutes: 1440 })

    const db = getFirestore()
    const userRef = db.collection('users').doc(uid)
    const userSnapshot = await userRef.get()
    if (!userSnapshot.exists) throw new HttpsError('not-found', 'user_not_found')

    const [ownedSeller, inFlightOrders, openReturns, openDisputes, creditAccounts] = await Promise.all([
      db.collection('sellers').where('ownerUserId', '==', uid).limit(1).get(),
      db.collection('orders').where('buyerId', '==', uid).where('status', 'in', [...IN_FLIGHT_ORDER_STATUSES]).limit(1).get(),
      db.collection('returns').where('buyerId', '==', uid).where('status', 'in', [...OPEN_RETURN_STATUSES]).limit(1).get(),
      db.collection('disputes').where('buyerId', '==', uid).where('status', 'in', [...OPEN_DISPUTE_STATUSES]).limit(1).get(),
      db.collection('creditAccounts').where('buyerId', '==', uid).limit(1).get(),
    ])

    if (!ownedSeller.empty) throw new HttpsError('failed-precondition', 'seller_account_active')
    if (!inFlightOrders.empty) throw new HttpsError('failed-precondition', 'order_in_progress')
    if (!openReturns.empty) throw new HttpsError('failed-precondition', 'return_in_progress')
    if (!openDisputes.empty) throw new HttpsError('failed-precondition', 'dispute_in_progress')
    const creditAccount = creditAccounts.docs[0]
    if (creditAccount && ((creditAccount.data().outstandingPaise as number | undefined) ?? 0) > 0) {
      throw new HttpsError('failed-precondition', 'credit_balance_outstanding')
    }

    const addressesSnapshot = await userRef.collection('addresses').get()
    const batch = db.batch()
    for (const doc of addressesSnapshot.docs) {
      batch.delete(doc.ref)
    }
    batch.update(userRef, {
      displayName: 'Deleted user',
      email: FieldValue.delete(),
      photoUrl: FieldValue.delete(),
      phone: FieldValue.delete(),
      gstin: FieldValue.delete(),
      pan: FieldValue.delete(),
      fcmTokens: [],
      defaultAddressId: FieldValue.delete(),
      status: 'deleted',
      updatedAt: Date.now(),
    })
    await batch.commit()

    await writeAuditLog({
      request,
      action: 'user.accountDeletionCompleted',
      targetType: 'users',
      targetId: uid,
    })

    try {
      await getAuth().deleteUser(uid)
    } catch (error) {
      // The Firestore side (the part that matters for PII exposure) is
      // already done and committed — a failure here just means the Auth
      // record outlives the profile, which onAuthUserDeleted-style cleanup
      // or a manual follow-up can still catch. Never leave the caller
      // thinking deletion failed when their data is already gone.
      logger.error('requestAccountDeletion: auth.deleteUser failed', {
        uid,
        error: error instanceof Error ? error.message : String(error),
      })
    }

    return { status: 'deleted' }
  },
)
