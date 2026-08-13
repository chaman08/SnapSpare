import { removeSellerStaffRequestSchema, sellerStaffSchema } from '@snapspare/shared'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { requireSellerPermission } from './staffAuthz.js'

/**
 * manage_staff-gated removal. Soft-deletes the sellerStaff row (status
 * 'removed', never hard-deleted, for audit) and — if the invite had already
 * been accepted — reverts the removed user's claims to plain 'buyer', the
 * same fallback onSellerStatusChange.ts uses when a seller is suspended.
 */
export const removeSellerStaff = onCall({ enforceAppCheck: true, region: 'asia-south1' }, async (request) => {
  const sellerId = requireSellerPermission(request, 'manage_staff')

  const parsed = removeSellerStaffRequestSchema.safeParse(request.data)
  if (!parsed.success) throw new HttpsError('invalid-argument', 'Invalid request')

  const db = getFirestore()
  const ref = db.collection('sellerStaff').doc(parsed.data.sellerStaffId)
  const snapshot = await ref.get()
  if (!snapshot.exists) throw new HttpsError('not-found', 'staff_not_found')

  const staff = sellerStaffSchema.parse({ id: snapshot.id, ...snapshot.data() })
  if (staff.sellerId !== sellerId) throw new HttpsError('permission-denied', 'not_your_staff')
  if (staff.role === 'owner') throw new HttpsError('failed-precondition', 'cannot_remove_owner')

  await ref.update({ status: 'removed', updatedAt: Date.now() })

  if (staff.userId) {
    await getAuth().setCustomUserClaims(staff.userId, { role: 'buyer' })
  }

  return { ok: true }
})
