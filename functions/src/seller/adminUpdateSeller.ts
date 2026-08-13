import {
  type AdminUpdateSellerResult,
  adminUpdateSellerRequestSchema,
  sellerSchema,
} from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { isAdminRequest } from '../orders/authz.js'
import { writeAuditLog } from '../util/auditLog.js'

/**
 * Sellers module (design brief item 2): suspend/reinstate an already-active
 * seller and set a per-seller commission override. Suspending writes
 * `sellers/{id}.status = 'suspended'`, which the existing
 * onSellerStatusChange.ts trigger reacts to by revoking the seller's
 * `sellerId` custom claim — no duplicate claims logic needed here, same
 * pattern reviewSellerApplication.ts relies on for approval.
 */
export const adminUpdateSeller = onCall(
  { enforceAppCheck: true, region: 'asia-south1' },
  async (request): Promise<AdminUpdateSellerResult> => {
    if (!request.auth || !isAdminRequest(request)) throw new HttpsError('permission-denied', 'admin_only')

    const parsed = adminUpdateSellerRequestSchema.safeParse(request.data)
    if (!parsed.success) throw new HttpsError('invalid-argument', 'Invalid request')
    const input = parsed.data

    const db = getFirestore()
    const ref = db.collection('sellers').doc(input.sellerId)
    const snapshot = await ref.get()
    if (!snapshot.exists) throw new HttpsError('not-found', 'seller_not_found')
    const seller = sellerSchema.parse({ id: snapshot.id, ...snapshot.data() })

    const now = Date.now()

    if (input.action === 'suspend') {
      if (seller.status !== 'active') throw new HttpsError('failed-precondition', 'seller_not_active')
      await ref.update({ status: 'suspended', updatedAt: now })
      await writeAuditLog({
        request,
        action: 'seller.suspend',
        targetType: 'sellers',
        targetId: seller.id,
        before: { status: seller.status },
        after: { status: 'suspended' },
        note: input.reason,
      })
      return { sellerId: seller.id, status: 'suspended' }
    }

    if (input.action === 'reinstate') {
      if (seller.status !== 'suspended') throw new HttpsError('failed-precondition', 'seller_not_suspended')
      await ref.update({ status: 'active', updatedAt: now })
      await writeAuditLog({
        request,
        action: 'seller.reinstate',
        targetType: 'sellers',
        targetId: seller.id,
        before: { status: seller.status },
        after: { status: 'active' },
      })
      return { sellerId: seller.id, status: 'active' }
    }

    // action === 'setCommission'
    await ref.update({
      commissionRatePercent: input.commissionRatePercent,
      updatedAt: now,
    })
    await writeAuditLog({
      request,
      action: 'seller.setCommission',
      targetType: 'sellers',
      targetId: seller.id,
      before: { commissionRatePercent: seller.commissionRatePercent ?? null },
      after: { commissionRatePercent: input.commissionRatePercent },
    })
    return { sellerId: seller.id, status: seller.status, commissionRatePercent: input.commissionRatePercent }
  },
)
