import {
  SELLER_STAFF_PERMISSION_MATRIX,
  type InviteSellerStaffResult,
  inviteSellerStaffRequestSchema,
} from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { requireSellerPermission } from './staffAuthz.js'

/**
 * Owner (or a staff member with manage_staff) invites a new staff member by
 * phone. The invited user doesn't need to exist yet — acceptSellerStaffInvite.ts
 * is what a newly-signed-in user calls to claim it once they've phone-OTP'd
 * in. Requested `permissions` are capped (never widened) to
 * SELLER_STAFF_PERMISSION_MATRIX[role] so a caller can't grant a packer
 * manager-level access by passing an inflated list.
 */
export const inviteSellerStaff = onCall({ enforceAppCheck: true, region: 'asia-south1' }, async (request): Promise<InviteSellerStaffResult> => {
  const sellerId = requireSellerPermission(request, 'manage_staff')

  const parsed = inviteSellerStaffRequestSchema.safeParse(request.data)
  if (!parsed.success) throw new HttpsError('invalid-argument', 'Invalid request')
  const { name, phone, role, permissions: requested } = parsed.data

  const maxPermissions = SELLER_STAFF_PERMISSION_MATRIX[role]
  const permissions = requested ? requested.filter((p) => maxPermissions.includes(p)) : maxPermissions

  const db = getFirestore()

  const existing = await db
    .collection('sellerStaff')
    .where('sellerId', '==', sellerId)
    .where('phone', '==', phone)
    .where('status', 'in', ['invited', 'active'])
    .limit(1)
    .get()
  if (!existing.empty) throw new HttpsError('already-exists', 'staff_already_invited')

  const now = Date.now()
  const ref = db.collection('sellerStaff').doc()
  await ref.set({
    sellerId,
    name,
    phone,
    role,
    permissions,
    status: 'invited',
    invitedAt: now,
    createdAt: now,
    updatedAt: now,
  })

  return { sellerStaffId: ref.id }
})
