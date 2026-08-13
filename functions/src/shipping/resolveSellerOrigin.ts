import { addressSchema, type Seller } from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import type { ShippingContactAddress } from './shippingProvider.js'

/**
 * A seller has no pincode of its own on `sellerSchema` — the one existing
 * path to its shipping origin is `seller.warehouseAddressId` →
 * `users/{seller.ownerUserId}/addresses/{warehouseAddressId}` (see
 * `packages/seed/src/seeders/seedSellers.ts`, the only place this shape is
 * currently written). Returns `undefined` when the seller hasn't set a
 * warehouse address yet — callers treat that as "not serviceable from this
 * seller" rather than guessing an origin.
 */
export async function resolveSellerOrigin(seller: Seller): Promise<ShippingContactAddress | undefined> {
  if (!seller.warehouseAddressId) return undefined

  const snapshot = await getFirestore()
    .collection('users')
    .doc(seller.ownerUserId)
    .collection('addresses')
    .doc(seller.warehouseAddressId)
    .get()
  if (!snapshot.exists) return undefined

  const parsed = addressSchema.safeParse({ id: snapshot.id, ...snapshot.data() })
  if (!parsed.success) return undefined
  const address = parsed.data

  return {
    name: address.contactName,
    phone: address.contactPhone,
    addressLine1: address.line1,
    addressLine2: address.line2,
    city: address.city,
    state: address.state,
    pincode: address.pincode,
  }
}
