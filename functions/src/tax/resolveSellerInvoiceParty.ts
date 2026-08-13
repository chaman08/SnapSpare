import { addressSchema, type AddressSnapshot, isValidStateCode, type Seller } from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'

/**
 * Resolves the seller's dispatch address for the "Sold By" panel of a tax
 * document — same source as shipping/resolveSellerOrigin.ts
 * (`seller.warehouseAddressId` → `users/{ownerUserId}/addresses/{id}`), but
 * returns the full `AddressSnapshot` shape a tax document needs (not
 * shipping's reduced `ShippingContactAddress`), and pins `stateCode` to the
 * GSTIN's own state code rather than trusting the address doc's — the
 * "location of supplier" for GST purposes is legally the registered GSTIN
 * state, which must never disagree with what's printed on the invoice even
 * if a warehouse address was entered with the wrong state.
 *
 * Deliberately read outside any Firestore transaction (like
 * checkout/appConfig.ts's getAppConfig or shipping/shippingConfig.ts) —
 * a seller's warehouse address changing in the moment between this read and
 * the invoice-generation transaction committing is an acceptable, rare risk
 * for a display field, not a correctness issue worth serializing on.
 */
export async function resolveSellerInvoiceAddress(seller: Seller): Promise<AddressSnapshot | undefined> {
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

  const gstinStateCode = seller.gstin.slice(0, 2)
  return {
    contactName: address.contactName,
    contactPhone: address.contactPhone,
    line1: address.line1,
    line2: address.line2,
    landmark: address.landmark,
    city: address.city,
    state: address.state,
    stateCode: isValidStateCode(gstinStateCode) ? gstinStateCode : address.stateCode,
    pincode: address.pincode,
    gstin: seller.gstin,
  }
}
