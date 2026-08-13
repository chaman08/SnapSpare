import type { SellerStaffPermission } from '@snapspare/shared'
import type { CallableRequest } from 'firebase-functions/v2/https'
import { HttpsError } from 'firebase-functions/v2/https'
import { requireSellerId } from '../orders/authz.js'

/**
 * Mirrors firestore.rules' hasSellerPermission(): a caller with the bare
 * `{ role: 'seller', sellerId }` claim (no `staffRole`) is the owner and
 * always passes; a staff account additionally needs `permission` in its
 * `permissions` claim (set at accept-invite time, capped to
 * SELLER_STAFF_PERMISSION_MATRIX[role]).
 */
export function requireSellerPermission(request: CallableRequest, permission: SellerStaffPermission): string {
  const sellerId = requireSellerId(request)
  const staffRole = request.auth?.token.staffRole
  if (staffRole === undefined) return sellerId

  const permissions = (request.auth?.token.permissions as string[] | undefined) ?? []
  if (!permissions.includes(permission)) {
    throw new HttpsError('permission-denied', `missing_permission:${permission}`)
  }
  return sellerId
}
