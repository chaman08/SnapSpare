import type { CallableRequest } from 'firebase-functions/v2/https'
import { HttpsError } from 'firebase-functions/v2/https'

/** Every seller-only callable in orders/ starts with this — mirrors firestore.rules' isSeller() check, just against the decoded ID token instead of a rules `request.auth.token`. */
export function requireSellerId(request: CallableRequest): string {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required')
  const sellerId = request.auth.token.sellerId
  if (typeof sellerId !== 'string' || sellerId.length === 0) {
    throw new HttpsError('permission-denied', 'seller_only')
  }
  return sellerId
}

export function requireUid(request: CallableRequest): string {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required')
  return request.auth.uid
}

export function isAdminRequest(request: CallableRequest): boolean {
  return request.auth?.token.role === 'admin'
}
